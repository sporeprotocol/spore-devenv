import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

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

// Function to delete a file
const deleteFile = (fileName: string): void => {
    const filePath = path.join(process.cwd(), fileName);

    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted ${fileName}.`);
        } else {
            console.log(`${fileName} not found.`);
        }
    } catch (error: any) {
        console.error(`Error deleting ${fileName}: ${error.message}`);
    }
};



function killCKBNode() {
    const ckbPort = 8114;
    let killCommand = '';

    switch (process.platform) {
        case 'win32':
            killCommand = `taskkill /F /IM ckb.exe`;
            break;
        case 'darwin':
        case 'linux':
            // Use the kill command to terminate the process
            killCommand = `kill -9 $(lsof -ti:${ckbPort})`;
            break;
        default:
            console.error(`Unsupported operating system: ${process.platform}`);
            return;
    }

    exec(killCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error while killing CKB node: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`CKB node termination error: ${stderr}`);
            return;
        }
        console.log('CKB node terminated successfully.');
    });
}

// Main function
const main = (): void => {
    // Delete the 'tmp' directory
    deleteDirectory('tmp');

    // Delete the 'config.json' file
    deleteFile('config.json');

    // Terminate CKB node
    killCKBNode()

    console.log('Commands executed successfully.');
};

// Run the main function
main();
