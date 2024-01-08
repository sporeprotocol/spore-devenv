import * as fs from 'fs';
import * as path from 'path';

// Function to delete a directory and its contents
const deleteDirectory = (directoryPath: string): void => {
    if (fs.existsSync(directoryPath)) {
        fs.readdirSync(directoryPath).forEach((file) => {
            const curPath = path.join(directoryPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                // Recursively delete subdirectories
                deleteDirectory(curPath);
            } else {
                // Delete files
                fs.unlinkSync(curPath);
            }
        });
        // Delete the directory itself
        fs.rmdirSync(directoryPath);
    }
};

// Function to rename a file
const renameFile = (oldFileName: string, newFileName: string): void => {
    const oldFilePath = path.join(__dirname, oldFileName);
    const newFilePath = path.join(__dirname, newFileName);

    if (fs.existsSync(oldFilePath)) {
        fs.renameSync(oldFilePath, newFilePath);
        console.log(`Renamed ${oldFileName} to ${newFileName}.`);
    } else {
        console.log(`${oldFileName} not found.`);
    }
};

// Main function
const main = (): void => {
    // Delete the 'tmp' directory
    deleteDirectory('tmp');

    // Rename 'lumos.json' to 'config.json'
    renameFile('lumos.json', 'config.json');

    console.log('Commands executed successfully.');
};

// Run the main function
main();
