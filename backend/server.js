const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

const app = express();
const port = 3000;

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, '../frontend/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Subdirectories for file types
const subDirectories = {
    'image/': 'images',
    'audio/': 'audio',
    'video/': 'videos',
    'application/': 'documents',
    'text/': 'text_files',
    'other': 'others',
};

// Create subdirectories
Object.values(subDirectories).forEach((subDir) => {
    const dirPath = path.join(uploadsDir, subDir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
});

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir); // Save files temporarily in uploadsDir
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); // Use original file name
    },
});
const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, '../frontend')));

// Log incoming requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// POST endpoint for file uploads
app.post('/organizer', upload.array('files', 50), (req, res) => {
    console.log('POST /organizer triggered');
    console.log('Files received:', req.files);

    if (!req.files || req.files.length === 0) {
        return res.status(400).send('No files uploaded');
    }

    // Organize files into subdirectories
    req.files.forEach((file) => {
        const fileType = file.mimetype.split('/')[0];
        const targetDir = subDirectories[`${fileType}/`] || subDirectories.other;
        const targetPath = path.join(uploadsDir, targetDir, file.originalname);

        fs.renameSync(file.path, targetPath); // Move file to its respective folder
    });

    res.redirect('/organizer');
});

// GET endpoint to display organized files and download folders
app.get('/organizer', (req, res) => {
    const folderLinks = Object.values(subDirectories)
        .map(
            (subDir) =>
                `<li><a href="/download/${subDir}">${subDir}</a></li>`
        )
        .join('');

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Organized Files</title>
            <link rel="stylesheet" href="/style.css">
        </head>
        <body>
            <h1>Organized Files</h1>
            <p>Files have been organized into the following folders:</p>
            <ul>
                ${folderLinks}
            </ul>
            <a href="/download/all" class="button">Download All Folders</a>
            <br><br>
            <a href="/">Go Back to Upload Page</a>
            <footer>
                <p>Powered by Your File Organizer</p>
            </footer>
        </body>
        </html>
    `);
});

// Endpoint to download individual folders
app.get('/download/:folder', (req, res) => {
    const folderName = req.params.folder;
    const folderPath = path.join(uploadsDir, folderName);

    if (!fs.existsSync(folderPath)) {
        return res.status(404).send('Folder not found');
    }

    const zipPath = path.join(uploadsDir, `${folderName}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${folderName}.zip`);

    archive.pipe(res);
    archive.directory(folderPath, false);
    archive.finalize();
});


// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
