const puppeteer = require('puppeteer');
const fs = require('fs');

// 설정 파일 로드
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// 페이지 대기 함수
const waitForTimeout = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: {width: 1024, height: 768},
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--display=:1']
  });

  const page = await browser.newPage();

  try {
    // 로그인 페이지 접속
    console.log('로그인 페이지 접속 중...');
    await page.goto('https://www.carmanager.co.kr/User/Login', { 
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    console.log('로그인 페이지 로드 완료');

    // 로그인 수행
    console.log('로그인 시도 중...');
    await page.waitForSelector('input[name="userid"]', { visible: true });
    await page.type('input[name="userid"]', config.login.username);
    await page.type('input[name="userpwd"]', config.login.password);
    
    // 로그인 버튼 클릭
    await Promise.all([
      page.click('.login-btn .btn.login'),
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
    let pageNum = 1;
    let hasNextPage = true;

    // 헤더 추가
    const headers = [
      '날짜', '경과일', '차량', '변속기', '연식', '등록일', 
      '연료', '주행거리', '색상', '가격', '옵션', '지역'
    ];
    allData.push(headers);

    // 데이터 페이지로 이동
    console.log('데이터 페이지로 이동 중...');
    await page.goto('https://www.carmanager.co.kr/Car/DataSale', {
      waitUntil: 'networkidle0'
    });

    // 잠시 대기
    await waitForTimeout(2000);

    // 페이지 HTML 저장하여 구조 확인
    const html = await page.content();
    fs.writeFileSync('data-page.html', html);
    console.log('페이지 HTML 저장됨');

    // 100개씩 보기 설정
    console.log('100개씩 보기로 설정 변경 중...');
    try {
      // URL에 pageSize 파라미터 추가하여 직접 이동
      const currentUrl = page.url();
      const newUrl = currentUrl.includes('?') 
        ? `${currentUrl}&pageSize=100` 
        : `${currentUrl}?pageSize=100`;
      
      await page.goto(newUrl, { waitUntil: 'networkidle0' });
      console.log('100개씩 보기 URL로 이동 완료');

      // 설정 변경 후 데이터 로딩 대기
      await waitForTimeout(3000);

      // 페이지 로딩 확인
      const rowCount = await page.evaluate(() => {
        const rows = document.querySelectorAll('table.uc_data tbody tr');
        return rows.length;
      });
      console.log(`현재 페이지에 ${rowCount}개의 행이 로드됨`);

    } catch (error) {
      console.log('100개씩 보기 설정 실패:', error.message);
    }

    while (hasNextPage) {
      console.log(`페이지 ${pageNum} 처리 중...`);

      // 데이터 추출
      const pageData = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table.uc_data tbody tr'));
        return rows.map(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          return cells.map(cell => cell.textContent.trim());
        });
      });

      if (pageData.length === 0) {
        console.log('더 이상 데이터가 없습니다.');
        break;
      }

      allData = allData.concat(pageData);
      console.log(`${pageData.length}개의 데이터 추출 완료`);

      // 다음 페이지 존재 여부 확인
      hasNextPage = await page.evaluate(() => {
        const pageTds = document.querySelectorAll('.uc_cpage td');
        const currentPage = document.querySelector('.uc_cpage td.on');
        if (!currentPage) return false;
        
        const currentPageNum = parseInt(currentPage.textContent.trim());
        const nextPageTd = Array.from(pageTds).find(td => 
          parseInt(td.textContent.trim()) === currentPageNum + 1
        );
        
        return !!nextPageTd;
      });

      if (hasNextPage) {
        console.log('다음 페이지로 이동...');
        
        // 다음 페이지 번호 클릭
        await page.evaluate(() => {
          const pageTds = document.querySelectorAll('.uc_cpage td');
          const currentPage = document.querySelector('.uc_cpage td.on');
          const currentPageNum = parseInt(currentPage.textContent.trim());
          
          const nextPageTd = Array.from(pageTds).find(td => 
            parseInt(td.textContent.trim()) === currentPageNum + 1
          );
          if (nextPageTd) nextPageTd.click();
        });

        // 페이지 로딩 대기
        await waitForTimeout(2000);

        // 데이터 로딩 확인
        const isLoaded = await page.evaluate(() => {
          const rows = document.querySelectorAll('table.uc_data tbody tr');
          return rows.length > 0;
        });

        if (isLoaded) {
          pageNum++;
          console.log(`페이지 ${pageNum}로 이동 완료`);
        } else {
          console.log('페이지 로딩 실패, 재시도...');
          hasNextPage = true;  // 다시 시도
        }
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