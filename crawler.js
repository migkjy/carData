const puppeteer = require('puppeteer');
const fs = require('fs');

// 메인 함수
async function run() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1024,768'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });

    // 로그인 페이지로 이동
    console.log('로그인 페이지로 이동 중...');
    await page.goto('https://www.carmanager.co.kr/Car/DataSale', {
      timeout: 60000,
      waitUntil: 'networkidle0'
    });

    // 잠시 대기
    await new Promise(r => setTimeout(r, 5000));

    // 현재 페이지의 HTML과 스크린샷 저장
    await page.screenshot({path: 'initial-page.png'});
    fs.writeFileSync('initial-page.html', await page.content());

    console.log('첫 페이지 저장 완료');

    // 페이지 내용 분석
    const pageInfo = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      const headers = document.querySelectorAll('th');
      return {
        tableCount: tables.length,
        headerTexts: Array.from(headers).map(h => h.textContent.trim())
      };
    });

    console.log('페이지 분석 결과:', pageInfo);

  } catch (error) {
    console.error('에러 발생:', error);
  } finally {
    console.log('크롤링 완료');
  }
}

// 크롤러 실행
console.log('크롤러를 시작합니다...');
run().catch(console.error);