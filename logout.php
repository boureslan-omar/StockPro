<?php
session_start();
session_destroy();
header('Location: /stockpro/login.php'); exit;
