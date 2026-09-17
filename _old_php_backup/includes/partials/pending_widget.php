<?php
/**
 * Pending User Approvals Widget
 * Included on Super Admin overview dashboard
 * HQ Multi-Role Inventory Management System
 */

require_once __DIR__ . '/../UserApproval.php';
require_once __DIR__ . '/../paths.php';

$approvalManager = new UserApproval();
$pendingCount = $approvalManager->getPendingCount();
?>

<div class="card border-0 shadow-sm rounded-3 mb-4" style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-left: 4px solid <?php echo $pendingCount > 0 ? '#f59e0b' : '#10b981'; ?> !important;">
    <div class="card-body p-3 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
        <div class="d-flex align-items-center gap-3">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: <?php echo $pendingCount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)'; ?>; color: <?php echo $pendingCount > 0 ? '#b45309' : '#047857'; ?>; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                <?php echo $pendingCount > 0 ? '⏳' : '✅'; ?>
            </div>
            <div>
                <div class="d-flex align-items-center gap-2">
                    <h6 class="mb-0 font-weight-bold" style="color: #0f172a; font-size: 15px;">Pending User Approvals</h6>
                    <?php if ($pendingCount > 0): ?>
                        <span class="badge" style="background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-size: 11px; padding: 3px 8px; border-radius: 999px;">
                            <?php echo $pendingCount; ?> Awaiting Review
                        </span>
                    <?php else: ?>
                        <span class="badge" style="background-color: #d1fae5; color: #047857; border: 1px solid #a7f3d0; font-size: 11px; padding: 3px 8px; border-radius: 999px;">
                            All Clear
                        </span>
                    <?php endif; ?>
                </div>
                <p class="text-muted small mb-0 mt-1" style="font-size: 13px;">
                    <?php if ($pendingCount > 0): ?>
                        There <?php echo $pendingCount === 1 ? 'is 1 new user registration' : "are {$pendingCount} new user registrations"; ?> requiring Super Admin verification before warehouse access is granted.
                    <?php else: ?>
                        No new account registration requests are currently pending.
                    <?php endif; ?>
                </p>
            </div>
        </div>

        <div class="d-flex align-items-center gap-2">
            <a href="<?php echo htmlspecialchars(app_url('users/pending.php')); ?>" 
               class="btn btn-sm font-weight-bold" 
               style="background-color: <?php echo $pendingCount > 0 ? '#4f46e5' : '#ffffff'; ?>; color: <?php echo $pendingCount > 0 ? '#ffffff' : '#334155'; ?>; border: 1px solid <?php echo $pendingCount > 0 ? '#4f46e5' : '#cbd5e1'; ?>; padding: 8px 16px; border-radius: 10px; text-decoration: none; transition: all 0.15s ease;">
                <i class="fas fa-user-check me-1"></i> Review Pending Queue &rarr;
            </a>
        </div>
    </div>
</div>
