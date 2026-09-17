<?php
$warehouse = isset($_GET['warehouse']) ? '?warehouse=' . (int) $_GET['warehouse'] : '';
header('Location: ../products/index.php' . $warehouse);
exit;
