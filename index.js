const puppeteer = require('puppeteer');
const fs = require('fs');

// 설정 파일 로드
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ],
    defaultViewport: {width: 1024, height: 768}
  });

  const page = await browser.newPage();

  try {
    // 로그인 페이지 접속
    console.log('로그인 페이지 접속 중...');
    try {
      await page.goto('https://www.carmanager.co.kr/User/Login/?returnurl=%2fCar%2fDataSale', { 
        waitUntil: 'networkidle0',
        timeout: 60000
      });
      console.log('페이지 로드 완료');
    } catch (error) {
      console.log('페이지 로드 중 에러:', error.message);
      // 스크린샷 저장
      await page.screenshot({path: 'error-page.png'});
      throw error;
    }

    // 페이지의 HTML 구조 확인
    console.log('로그인 페이지 구조 분석 중...');
    
    // 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 페이지의 HTML 저장
    const html = await page.content();
    fs.writeFileSync('page.html', html);
    console.log('페이지 HTML이 page.html에 저장되었습니다.');
    
    // 페이지의 스크린샷 저장
    await page.screenshot({path: 'login-page.png', fullPage: true});
    console.log('페이지 스크린샷이 login-page.png에 저장되었습니다.');

    // 로그인 수행
    console.log('로그인 시도 중...');
    await page.type('#UserId', config.login.username);
    await page.type('#Password', config.login.password);
    
    // 로그인 버튼 클릭
    await Promise.all([
      page.click('.btn-login'),
      page.waitForNavigation({ waitUntil: 'networkidle0' })
    ]);

    // 로그인 성공 확인
    const currentUrl = page.url();
    if (currentUrl.includes('Login')) {
      throw new Error('로그인 실패: 아이디나 비밀번호를 확인해주세요.');
    }
    console.log('로그인 완료');

    // 데이터를 저장할 배열
    let allData = [];

    // 100개씩 보기로 변경된 URL로 이동
    console.log('데이터 페이지로 이동 중...');
    await page.goto('https://www.carmanager.co.kr/Car/DataSale?pageSize=100', {
      waitUntil: 'networkidle0'
    });

    // 잠시 대기하여 페이지 로딩 확인
    await page.waitForTimeout(2000);

    // 총 페이지 수 확인
    const totalPages = await page.evaluate(() => {
      const paginationItems = document.querySelectorAll('.pagination li');
      if (paginationItems.length > 0) {
        const lastPageNum = paginationItems[paginationItems.length - 2]?.textContent;
        return parseInt(lastPageNum, 10) || 1;
      }
      return 1;
    });

    console.log(`총 페이지 수: ${totalPages}`);

    // 각 페이지 순회
    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
      console.log(`페이지 ${currentPage}/${totalPages} 처리 중...`);

      // 테이블 데이터 추출
      const pageData = await page.evaluate(() => {
        const rows = document.querySelectorAll('table.table tbody tr');
        return Array.from(rows).map(row => {
          const cells = row.querySelectorAll('td');
          return Array.from(cells).map(cell => cell.textContent.trim());
        });
      });

      allData = allData.concat(pageData);
      console.log(`페이지 ${currentPage}에서 ${pageData.length}개의 데이터 추출`);

      // 다음 페이지로 이동 (마지막 페이지가 아닌 경우)
      if (currentPage < totalPages) {
        const nextPageUrl = `https://www.carmanager.co.kr/Car/DataSale?pageSize=100&page=${currentPage + 1}`;
        console.log(`다음 페이지로 이동: ${nextPageUrl}`);
        await page.goto(nextPageUrl, {
          waitUntil: 'networkidle0'
        });
        // 페이지 로딩 대기
        await page.waitForTimeout(2000);
      }
    }

    // 데이터를 CSV 파일로 저장
    console.log('데이터를 CSV 파일로 저장 중...');
    const csvContent = allData.map(row => row.join(',')).join('\n');
    const filePath = 'carmanager_data.csv';
    fs.writeFileSync(filePath, csvContent);
    console.log(`총 ${allData.length}개의 데이터를 ${filePath} 파일에 저장했습니다.`);

  } catch (error) {
    console.error('에러 발생:', error);
  } finally {
    await browser.close();
  }
})();