<?php
$warehouse = isset($_GET['warehouse']) ? '?warehouse=' . (int) $_GET['warehouse'] : '';
header('Location: movement_report.php' . $warehouse);
exit;
