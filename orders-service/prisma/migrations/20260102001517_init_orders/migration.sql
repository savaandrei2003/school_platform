-- CreateTable
CREATE TABLE `Order` (
    `id` CHAR(36) NOT NULL,
    `parentSub` CHAR(36) NOT NULL,
    `parentEmail` VARCHAR(191) NOT NULL,
    `childId` CHAR(36) NOT NULL,
    `orderDate` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'CANCELED') NOT NULL DEFAULT 'PENDING',
    `menuDate` DATETIME(3) NOT NULL,
    `menuId` CHAR(36) NULL,
    `placedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `canceledAt` DATETIME(3) NULL,

    INDEX `idx_parentSub`(`parentSub`),
    INDEX `idx_orderDate`(`orderDate`),
    UNIQUE INDEX `uniq_child_orderDate`(`childId`, `orderDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderSelection` (
    `id` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `choices` JSON NOT NULL,
    `snapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `OrderSelection_orderId_key`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrderSelection` ADD CONSTRAINT `OrderSelection_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
