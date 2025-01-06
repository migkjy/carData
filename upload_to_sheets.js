const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

async function uploadToGoogleSheets() {
    const auth = new google.auth.GoogleAuth({
        keyFile: '/tmp/credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1QYIa0Yc2yh8ZTYatb9wnhPEOcvgU7Cdc5EPHKkB51YE';

    try {
        // CSV 파일 읽기
        const csvContent = await fs.readFile('carmanager_data.csv', 'utf8');
        const rows = csvContent.split('\n').map(row => row.split(','));

        // 현재 월 시트 이름 생성
        const today = new Date();
        const sheetName = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

        // 새 시트 생성 시도
        try {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: sheetName
                            }
                        }
                    }]
                }
            });
        } catch (error) {
            console.log('Sheet might already exist, continuing...');
        }

        // 데이터 업로드
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            resource: {
                values: rows
            }
        });

        console.log('Data uploaded successfully to Google Sheets!');
    } catch (error) {
        console.error('Error uploading to Google Sheets:', error);
    }
}

uploadToGoogleSheets();