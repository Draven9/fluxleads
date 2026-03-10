import fs from 'fs';

const errors = JSON.parse(fs.readFileSync('errors.json', 'utf8'));

let count = 0;
for (const file of errors) {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (!content.includes('"use client"') && !content.includes("'use client'")) {
            fs.writeFileSync(file, '"use client";\n\n' + content);
            console.log(`Added "use client" to ${file}`);
            count++;
        } else {
            console.log(`Already has "use client": ${file}`);
        }
    } else {
        console.warn(`File not found: ${file}`);
    }
}
console.log(`\nSuccessfully updated ${count} files.`);
