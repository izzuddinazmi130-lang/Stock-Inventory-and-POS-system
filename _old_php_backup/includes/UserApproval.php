<?php
/**
 * User Approval Management System
 * Super Admin workflow for approving, rejecting, and querying pending registrants
 * HQ Multi-Role Inventory Management System
 */

require_once __DIR__ . '/../config/database.php';

class UserApproval {
    private $db;

    public function __construct($pdo = null) {
        if ($pdo instanceof PDO) {
            $this->db = $pdo;
        } else {
            $this->db = Database::getInstance()->getConnection();
        }
    }

    /**
     * Get count of users awaiting approval (is_active = 0)
     *
     * @return int
     */
    public function getPendingCount(): int {
        try {
            $stmt = $this->db->query("SELECT COUNT(*) FROM users WHERE is_active = 0");
            return (int)$stmt->fetchColumn();
        } catch (Throwable $e) {
            error_log("UserApproval getPendingCount error: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Get all users awaiting approval with warehouse details
     *
     * @return array
     */
    public function getPending(): array {
        try {
            $stmt = $this->db->query("
                SELECT 
                    u.id,
                    u.email,
                    u.username,
                    u.full_name,
                    u.role,
                    u.assigned_warehouse_id,
                    u.is_active,
                    u.created_at,
                    w.name AS warehouse_name,
                    w.code AS warehouse_code
                FROM users u
                LEFT JOIN warehouses w ON u.assigned_warehouse_id = w.id
                WHERE u.is_active = 0
                ORDER BY u.created_at DESC
            ");
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {
            error_log("UserApproval getPending error: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Approve a pending user (is_active = 1)
     *
     * @param int $userId Target user ID
     * @param int|null $adminId Super Admin ID executing the action
     * @return bool
     */
    public function approve(int $userId, ?int $adminId = null): bool {
        try {
            $stmt = $this->db->prepare("SELECT email, full_name, role FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                return false;
            }

            $update = $this->db->prepare("UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = ?");
            $update->execute([$userId]);

            $this->logAction($adminId, 'user_approval', [
                'target_user_id' => $userId,
                'target_email' => $user['email'],
                'target_role' => $user['role'],
                'action_taken' => 'approved'
            ]);

            return true;
        } catch (Throwable $e) {
            error_log("UserApproval approve error: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Reject a user registration (is_active = 2)
     *
     * @param int $userId Target user ID
     * @param int|null $adminId Super Admin ID executing the action
     * @param string $reason Optional rejection note
     * @return bool
     */
    public function reject(int $userId, ?int $adminId = null, string $reason = ''): bool {
        try {
            $stmt = $this->db->prepare("SELECT email, full_name, role FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                return false;
            }

            $update = $this->db->prepare("UPDATE users SET is_active = 2, updated_at = NOW() WHERE id = ?");
            $update->execute([$userId]);

            $this->logAction($adminId, 'user_rejection', [
                'target_user_id' => $userId,
                'target_email' => $user['email'],
                'target_role' => $user['role'],
                'reason' => $reason,
                'action_taken' => 'rejected'
            ]);

            return true;
        } catch (Throwable $e) {
            error_log("UserApproval reject error: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Permanently delete a pending or rejected user
     *
     * @param int $userId Target user ID
     * @param int|null $adminId Super Admin ID executing the action
     * @return bool
     */
    public function deleteUser(int $userId, ?int $adminId = null): bool {
        try {
            $stmt = $this->db->prepare("SELECT email, role, is_active FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            // Prevent deleting active super_admin via this method
            if (!$user || $user['role'] === 'super_admin') {
                return false;
            }

            // Clean up related audit logs before deleting pending user
            $this->db->prepare("DELETE FROM audit_logs WHERE user_id = ?")->execute([$userId]);

            $del = $this->db->prepare("DELETE FROM users WHERE id = ? AND is_active IN (0, 2)");
            $del->execute([$userId]);

            $this->logAction($adminId, 'user_deletion', [
                'target_user_id' => $userId,
                'target_email' => $user['email'],
                'target_role' => $user['role'],
                'action_taken' => 'deleted_pending'
            ]);

            return true;
        } catch (Throwable $e) {
            error_log("UserApproval deleteUser error: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Write an entry to audit_logs
     */
    private function logAction(?int $userId, string $action, array $details): void {
        try {
            $stmt = $this->db->prepare("
                INSERT INTO audit_logs (user_id, action, ip_address, user_agent, new_values) 
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $userId,
                $action,
                $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
                $_SERVER['HTTP_USER_AGENT'] ?? 'SuperAdmin Portal',
                json_encode($details)
            ]);
        } catch (Throwable $e) {
            error_log("UserApproval logAction error: " . $e->getMessage());
        }
    }
}
