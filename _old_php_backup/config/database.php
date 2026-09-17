<?php
// config/database.php
class Database {
    private static $instance = null;
    private $pdo;
    private $config;
    
    private function __construct() {
        $this->config = [
            'host' => getenv('DB_HOST') ?: 'localhost',
            'dbname' => getenv('DB_NAME') ?: 'hq_inventory_system',
            'user' => getenv('DB_USER') ?: 'root',
            'pass' => getenv('DB_PASS') ?: ''
        ];
        
        try {
            $this->pdo = new PDO(
                "mysql:host={$this->config['host']};dbname={$this->config['dbname']};charset=utf8mb4",
                $this->config['user'],
                $this->config['pass'],
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]
            );
        } catch (PDOException $e) {
            die("Database connection failed: " . $e->getMessage());
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->pdo;
    }
    
    // External Database Connections
    public function getKaftanasiaDB() {
        return $this->connectExternal([
            'host' => getenv('KAFTANASIA_DB_HOST') ?: 'localhost',
            'dbname' => getenv('KAFTANASIA_DB_NAME') ?: 'kaftanasia_db',
            'user' => getenv('KAFTANASIA_DB_USER') ?: 'kaftanasia_user',
            'pass' => getenv('KAFTANASIA_DB_PASS') ?: ''
        ]);
    }
    
    public function getAstechDB() {
        return $this->connectExternal([
            'host' => getenv('ASTECH_DB_HOST') ?: 'localhost',
            'dbname' => getenv('ASTECH_DB_NAME') ?: 'astech_db',
            'user' => getenv('ASTECH_DB_USER') ?: 'astech_user',
            'pass' => getenv('ASTECH_DB_PASS') ?: ''
        ]);
    }
    
    private function connectExternal($config) {
        try {
            return new PDO(
                "mysql:host={$config['host']};dbname={$config['dbname']};charset=utf8mb4",
                $config['user'],
                $config['pass'],
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );
        } catch (PDOException $e) {
            error_log("External DB connection failed: " . $e->getMessage());
            return null;
        }
    }
}