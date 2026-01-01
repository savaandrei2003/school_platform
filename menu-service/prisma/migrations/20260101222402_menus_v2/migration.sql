-- CreateTable
CREATE TABLE `DailyMenu` (
    `id` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DailyMenu_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MenuOption` (
    `id` CHAR(36) NOT NULL,
    `menuId` CHAR(36) NOT NULL,
    `category` ENUM('SOUP', 'MAIN', 'DESSERT', 'RESERVE') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `allergens` JSON NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,

    INDEX `MenuOption_menuId_category_idx`(`menuId`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MenuOption` ADD CONSTRAINT `MenuOption_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `DailyMenu`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
