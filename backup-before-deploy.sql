-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: ganpti_mobile
-- ------------------------------------------------------
-- Server version	8.0.46-0ubuntu0.24.04.4

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lead_id` int NOT NULL,
  `name` varchar(60) NOT NULL,
  `phone` varchar(10) NOT NULL,
  `brand` varchar(30) NOT NULL,
  `problem` varchar(30) NOT NULL,
  `note` varchar(120) DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `distance_km` decimal(8,2) DEFAULT NULL,
  `device` varchar(20) DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_lead` (`lead_id`),
  UNIQUE KEY `unique_phone` (`phone`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `day_books`
--

DROP TABLE IF EXISTS `day_books`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `day_books` (
  `id` int NOT NULL AUTO_INCREMENT,
  `book_date` date NOT NULL,
  `note` varchar(200) DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_book_date` (`book_date`),
  KEY `created_by_idx` (`created_by`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `day_books`
--

LOCK TABLES `day_books` WRITE;
/*!40000 ALTER TABLE `day_books` DISABLE KEYS */;
INSERT INTO `day_books` VALUES (1,'2026-09-16',NULL,2,'2026-09-16 08:27:55'),(2,'2026-09-15',NULL,2,'2026-09-16 09:36:44'),(3,'2026-09-17',NULL,2,'2026-09-17 03:32:44'),(4,'2026-09-18',NULL,9,'2026-09-18 03:15:40'),(5,'2026-09-19',NULL,9,'2026-09-19 12:14:13'),(6,'2026-09-20',NULL,2,'2026-09-20 04:15:10');
/*!40000 ALTER TABLE `day_books` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `follow_ups`
--

DROP TABLE IF EXISTS `follow_ups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `follow_ups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lead_id` int NOT NULL,
  `follow_status` varchar(20) NOT NULL DEFAULT 'pending',
  `follow_at` datetime DEFAULT NULL,
  `note` varchar(200) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `lead_idx` (`lead_id`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `follow_ups`
--

LOCK TABLES `follow_ups` WRITE;
/*!40000 ALTER TABLE `follow_ups` DISABLE KEYS */;
INSERT INTO `follow_ups` VALUES (1,3,'pending',NULL,NULL,'2026-09-14 11:50:23'),(2,3,'no_answer','2026-09-14 20:30:00','test','2026-09-14 12:00:08'),(3,3,'waiting','2026-09-14 20:30:00','test','2026-09-14 12:25:40'),(4,7,'done','2026-09-18 15:06:00',NULL,'2026-09-17 09:36:39'),(5,6,'waiting',NULL,'Customer not answered','2026-09-17 09:37:19'),(6,6,'done','2026-09-17 15:07:00','Customer not ans','2026-09-17 09:37:59');
/*!40000 ALTER TABLE `follow_ups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leads`
--

DROP TABLE IF EXISTS `leads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(60) NOT NULL,
  `phone` varchar(10) NOT NULL,
  `brand` varchar(30) NOT NULL,
  `problem` varchar(30) NOT NULL,
  `note` varchar(120) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `accuracy_m` int DEFAULT NULL,
  `distance_km` decimal(8,2) DEFAULT NULL,
  `device` varchar(20) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `ip_address` varchar(64) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'new',
  `verified_at` timestamp NULL DEFAULT NULL,
  `follow_status` varchar(20) DEFAULT NULL,
  `follow_at` datetime DEFAULT NULL,
  `follow_note` varchar(200) DEFAULT NULL,
  `follow_updated_at` timestamp NULL DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leads`
--

LOCK TABLES `leads` WRITE;
/*!40000 ALTER TABLE `leads` DISABLE KEYS */;
INSERT INTO `leads` VALUES (5,'Monu Jangid','8058276387','Realme','Camera',NULL,'2026-09-16 16:55:53',26.8869893,75.7549059,16,0.10,'Mobile','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36','49.36.241.118','spam',NULL,NULL,NULL,NULL,NULL,NULL),(6,'Amit','8209627580','Realme','Screen',NULL,'2026-09-16 17:45:57',26.8869793,75.7548914,64,0.10,'Mobile','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36','49.36.241.118','spam',NULL,'done','2026-09-17 15:07:00','Customer not ans','2026-09-17 09:38:00',11),(7,'Koshvender Singh Rajpoot','6367857216','Apple','Battery','Edge 60 pro','2026-09-17 09:14:59',26.8869759,75.7549905,22,0.00,'Mobile','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36','1.39.163.129','verified','2026-09-17 09:19:27','done','2026-09-18 15:06:00',NULL,'2026-09-17 09:36:40',10),(8,'Ramavtar Saini','7877687810','Other','Screen',NULL,'2026-09-17 17:23:49',26.8968086,75.7713658,37,1.90,'Mobile','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36','1.39.155.63','verified','2026-09-17 17:24:45',NULL,NULL,NULL,NULL,12),(9,'Shubham Saini','7976933462','Vivo','Screen','V20','2026-09-18 16:24:43',26.8869063,75.7549288,22,0.10,'Mobile','Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/153.0.8010.24 Mobile/15E148 Safari/604.1','47.15.82.138','new',NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `leads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ledger_entries`
--

DROP TABLE IF EXISTS `ledger_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ledger_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `day_book_id` int NOT NULL,
  `category` varchar(20) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `transfer_amount` decimal(12,2) DEFAULT NULL,
  `mt_subtype` varchar(20) DEFAULT NULL,
  `provider` varchar(40) DEFAULT NULL,
  `description` varchar(200) DEFAULT NULL,
  `payment_method` varchar(20) DEFAULT NULL,
  `lead_id` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `customer_phone` varchar(10) DEFAULT NULL,
  `device_brand` varchar(40) DEFAULT NULL,
  `payment_flow` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `day_category_idx` (`day_book_id`,`category`),
  KEY `lead_idx` (`lead_id`)
) ENGINE=MyISAM AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ledger_entries`
--

LOCK TABLES `ledger_entries` WRITE;
/*!40000 ALTER TABLE `ledger_entries` DISABLE KEYS */;
INSERT INTO `ledger_entries` VALUES (1,3,'recharge',200.00,NULL,NULL,'Airtel',NULL,NULL,NULL,9,'2026-09-17 09:21:45',NULL,NULL,NULL),(2,3,'money_transfer',400.00,NULL,'redem',NULL,NULL,NULL,NULL,9,'2026-09-17 09:22:02',NULL,NULL,NULL),(3,3,'accessory',100.00,NULL,NULL,NULL,'Tempered',NULL,NULL,9,'2026-09-17 09:22:48',NULL,NULL,NULL),(4,3,'accessory',150.00,NULL,NULL,NULL,'Tempered',NULL,NULL,9,'2026-09-17 09:23:00',NULL,NULL,NULL),(5,3,'repair',1000.00,NULL,NULL,NULL,'Test',NULL,NULL,9,'2026-09-17 09:23:41',NULL,'Xiaomi',NULL),(6,3,'payment',500.00,NULL,NULL,NULL,'Assessosies',NULL,NULL,9,'2026-09-17 09:24:10',NULL,NULL,'given'),(7,3,'payment',2500.00,NULL,NULL,NULL,'Room rent',NULL,NULL,9,'2026-09-17 09:24:35',NULL,NULL,'taken'),(8,3,'recharge',299.00,NULL,NULL,'Airtel',NULL,NULL,NULL,9,'2026-09-17 17:20:16',NULL,NULL,NULL),(9,3,'money_transfer',5050.00,NULL,'mt',NULL,NULL,NULL,NULL,9,'2026-09-17 17:20:33',NULL,NULL,NULL),(10,3,'repair',1200.00,NULL,NULL,NULL,'Combo',NULL,NULL,9,'2026-09-17 17:20:53',NULL,'Samsung',NULL),(11,4,'recharge',350.00,NULL,NULL,'Airtel',NULL,NULL,NULL,9,'2026-09-18 06:32:50',NULL,NULL,NULL),(12,4,'recharge',350.00,NULL,NULL,'Airtel',NULL,NULL,NULL,9,'2026-09-18 06:33:01',NULL,NULL,NULL),(13,4,'money_transfer',8080.00,NULL,'mt',NULL,NULL,NULL,NULL,9,'2026-09-18 06:33:10',NULL,NULL,NULL),(14,4,'repair',50.00,NULL,NULL,NULL,'Repair',NULL,NULL,9,'2026-09-18 06:33:53',NULL,'Xiaomi',NULL),(15,4,'repair',1800.00,NULL,NULL,NULL,'A9 2020 combo',NULL,NULL,9,'2026-09-18 07:31:18',NULL,'Oppo',NULL),(16,4,'accessory',200.00,NULL,NULL,NULL,'Flip cover',NULL,NULL,9,'2026-09-18 07:31:59',NULL,NULL,NULL),(17,4,'repair',750.00,NULL,NULL,NULL,'Battery y93',NULL,NULL,9,'2026-09-18 09:04:21',NULL,'Vivo',NULL),(18,4,'repair',100.00,NULL,NULL,NULL,'Y93 on/off flax',NULL,NULL,9,'2026-09-18 09:04:45',NULL,'Vivo',NULL),(19,4,'money_transfer',2020.00,NULL,'mt',NULL,NULL,NULL,NULL,9,'2026-09-18 09:15:43',NULL,NULL,NULL),(20,4,'money_transfer',210.00,NULL,'mt',NULL,NULL,NULL,NULL,9,'2026-09-18 09:15:52',NULL,NULL,NULL),(21,4,'recharge',30.00,NULL,NULL,'Jio',NULL,NULL,NULL,9,'2026-09-18 09:27:43',NULL,NULL,NULL),(22,4,'repair',100.00,NULL,NULL,NULL,'Jek celink',NULL,NULL,9,'2026-09-18 14:42:22',NULL,'Samsung',NULL),(23,4,'accessory',200.00,NULL,NULL,NULL,'Tamper uv M',NULL,NULL,9,'2026-09-18 14:43:48',NULL,NULL,NULL),(24,4,'money_transfer',510.00,NULL,'mt',NULL,NULL,NULL,NULL,9,'2026-09-18 14:44:57',NULL,NULL,NULL),(25,4,'money_transfer',510.00,NULL,'mt',NULL,NULL,NULL,NULL,9,'2026-09-18 14:45:07',NULL,NULL,NULL),(26,4,'recharge',350.00,NULL,NULL,'Airtel',NULL,NULL,NULL,9,'2026-09-18 14:45:39',NULL,NULL,NULL),(27,4,'recharge',20.00,NULL,NULL,'Jio',NULL,NULL,NULL,9,'2026-09-18 14:45:44',NULL,NULL,NULL),(28,4,'recharge',30.00,NULL,NULL,'Jio',NULL,NULL,NULL,9,'2026-09-18 14:45:50',NULL,NULL,NULL),(29,4,'recharge',350.00,NULL,NULL,'Airtel',NULL,NULL,NULL,9,'2026-09-18 14:45:58',NULL,NULL,NULL),(30,4,'recharge',350.00,NULL,NULL,'Airtel',NULL,NULL,NULL,9,'2026-09-18 14:46:06',NULL,NULL,NULL),(31,4,'recharge',350.00,NULL,NULL,'Airtel',NULL,NULL,NULL,9,'2026-09-18 14:46:16',NULL,NULL,NULL),(32,4,'recharge',33.00,NULL,NULL,'Airtel',NULL,NULL,NULL,9,'2026-09-18 14:46:22',NULL,NULL,NULL),(33,4,'accessory',100.00,NULL,NULL,NULL,'Cover',NULL,NULL,9,'2026-09-18 14:47:56',NULL,NULL,NULL),(34,4,'recharge',30.00,NULL,NULL,'Jio',NULL,NULL,NULL,9,'2026-09-18 14:55:10',NULL,NULL,NULL),(35,4,'recharge',20.00,NULL,NULL,'Jio',NULL,NULL,NULL,9,'2026-09-18 15:29:22',NULL,NULL,NULL),(36,4,'accessory',450.00,NULL,NULL,NULL,'Iphone charger',NULL,NULL,9,'2026-09-18 15:54:58',NULL,NULL,NULL),(37,4,'recharge',20.00,NULL,NULL,'Jio',NULL,NULL,NULL,9,'2026-09-18 16:00:53',NULL,NULL,NULL),(38,4,'accessory',18.00,NULL,NULL,NULL,'Photo copy',NULL,NULL,9,'2026-09-18 16:01:17',NULL,NULL,NULL),(39,4,'money_transfer',1010.00,NULL,'aps',NULL,NULL,NULL,NULL,9,'2026-09-18 16:01:29',NULL,NULL,NULL),(40,4,'accessory',140.00,NULL,NULL,NULL,'Data cable RSD C',NULL,NULL,9,'2026-09-18 16:07:26',NULL,NULL,NULL),(41,4,'money_transfer',710.00,NULL,'mt',NULL,NULL,NULL,NULL,9,'2026-09-18 16:18:57',NULL,NULL,NULL),(42,4,'payment',600.00,NULL,NULL,NULL,'Petrol',NULL,NULL,9,'2026-09-18 16:19:20',NULL,NULL,'given'),(43,4,'payment',400.00,NULL,NULL,NULL,'Dr. Fees',NULL,NULL,9,'2026-09-18 16:20:11',NULL,NULL,'given'),(44,4,'payment',750.00,NULL,NULL,NULL,'Medical Store',NULL,NULL,9,'2026-09-18 16:20:23',NULL,NULL,'given');
/*!40000 ALTER TABLE `ledger_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `slug` varchar(30) NOT NULL,
  `name` varchar(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=169 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin','Admin'),(2,'staff','Staff'),(3,'customer','Customer');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shop_settings`
--

DROP TABLE IF EXISTS `shop_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shop_settings` (
  `id` int NOT NULL,
  `latitude` decimal(10,7) NOT NULL,
  `longitude` decimal(10,7) NOT NULL,
  `label` varchar(120) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shop_settings`
--

LOCK TABLES `shop_settings` WRITE;
/*!40000 ALTER TABLE `shop_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `shop_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  `email` varchar(120) DEFAULT NULL,
  `phone` varchar(10) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `role_id` int NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `lead_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `must_change_password` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_email` (`email`),
  UNIQUE KEY `unique_phone` (`phone`),
  KEY `fk_users_role` (`role_id`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (2,'Shubham','admin@ganpatimobilepoint.in',NULL,'61e812dd7b641aeb65899bd45d8af686:976f6cca03d8e212c41971a92f756c44b20cb55ad9ff0a81f0a91eaa66fd12345359297e2a62e2a4d7ac6e50b9a34de954c73d44b982b1ae1747dc980139a6f3',1,'active',NULL,'2026-09-14 12:17:32',0),(7,'Shubham Saini','shubham@ganptmobile.in',NULL,'0906644525bf28107bbecaa61884de74:6e75c22b4419c810f4130fdc85644dbfc19ec1b4eb4d6d44779c9f6179586880bf631f244911fe0132bb8988b0672f0376e9918b7d60073844a93281351b3d71',2,'suspended',NULL,'2026-09-16 08:46:33',1),(8,'Mandal','mandal@ganpatimobile.in',NULL,'da90abb2c4394617be5aaa9356f7bca3:89902e7f43df512d45989732572425144a49a6dca748c5538459d57f161960d169059739b7b267d107ec828bf852162965fb0e05f4a73075cd88405e622976d6',2,'active',NULL,'2026-09-16 08:47:20',1),(9,'Shubham','gm9782932128@gmail.com',NULL,'73c05b020faf297565000d7c21df6655:e3a5f5cc4d21c2d248ce1af207239162903e564634124c1be2e1a6ef2196cb48ba52ae2a7026c819ea803e12513a96cdf592bb480646b112dcbc4440f2ac15d1',2,'active',NULL,'2026-09-17 09:17:38',0),(10,'Koshvender Singh Rajpoot',NULL,'6367857216',NULL,3,'active',7,'2026-09-17 09:19:27',0),(11,'Amit',NULL,'8209627580',NULL,3,'active',6,'2026-09-17 17:19:09',0),(12,'Ramavtar Saini',NULL,'7877687810',NULL,3,'active',8,'2026-09-17 17:24:45',0);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-20  4:26:03
