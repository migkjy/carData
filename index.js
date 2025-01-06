const puppeteer = require('puppeteer');
const fs = require('fs');

// 설정 파일 로드
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// 페이지 대기 함수
const waitForTimeout = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
    await page.waitForSelector('input[name="userid"]');
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

    // 100개씩 보기로 변경된 URL로 이동
    console.log('데이터 페이지로 이동 중...');
    await page.goto('https://www.carmanager.co.kr/Car/DataSale?pageSize=100', {
      waitUntil: 'networkidle0'
    });

    // 잠시 대기하여 페이지 로딩 확인
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 데이터 페이지의 HTML 저장
    const dataPageHtml = await page.content();
    fs.writeFileSync('data-page.html', dataPageHtml);
    console.log('데이터 페이지 HTML이 data-page.html에 저장되었습니다.');
    
    // 데이터 페이지 스크린샷 저장
    await page.screenshot({path: 'data-page.png', fullPage: true});
    console.log('데이터 페이지 스크린샷이 data-page.png에 저장되었습니다.');

    // 총 페이지 수 확인
    const totalPages = await page.evaluate(() => {
      // uc_cpage 클래스를 가진 div 내의 모든 td 엘리먼트를 찾습니다
      const pageTds = document.querySelectorAll('.uc_cpage td');
      if (!pageTds.length) return 1;
      
      // 모든 페이지 번호를 추출하여 가장 큰 숫자를 찾습니다
      const pageNumbers = Array.from(pageTds)
        .map(td => parseInt(td.textContent.trim(), 10))
        .filter(num => !isNaN(num));
      
      return Math.max(...pageNumbers, 1);
    });

    console.log('발견된 총 페이지 수:', totalPages);

    console.log(`총 페이지 수: ${totalPages}`);

    // 각 페이지 순회
    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
      console.log(`페이지 ${currentPage}/${totalPages} 처리 중...`);

      // 테이블 데이터 추출
      const pageData = await page.evaluate(() => {
        const rows = document.querySelectorAll('table.uc_data tbody tr');
        return Array.from(rows).map(row => {
          const cells = row.querySelectorAll('td');
          const rawData = Array.from(cells).map(cell => cell.textContent.trim());
          
          // 연식과 등록월 분리
          const yearMatch = rawData[4]?.match(/\[(\d{4})\]\s*,?\s*(\d{4})\.(\d{2})?/);
          const year = yearMatch ? yearMatch[1] : '';
          const regDate = yearMatch && yearMatch[2] && yearMatch[3] ? `${yearMatch[2]}.${yearMatch[3]}` : '';
          
          // 주행거리에서 숫자만 추출
          const kmMatch = rawData[6]?.match(/[\d,]+/);
          const km = kmMatch ? parseInt(kmMatch[0].replace(/,/g, '')) : '';
          
          // 가격에서 숫자만 추출
          const priceMatch = rawData[8]?.match(/[\d,]+/);
          const price = priceMatch ? parseInt(priceMatch[0].replace(/,/g, '')) : '';
          
          // 데이터 포맷팅
          return [
            rawData[0] || '',         // 날짜
            rawData[1]?.replace(/\s+일$/, '') || '',  // 경과일수 (일 제거)
            rawData[2] || '',         // 차량
            rawData[3] || '',         // 변속기
            year,                     // 연식
            regDate,                  // 등록일
            rawData[5] || '',         // 연료
            km,                       // 주행거리
            rawData[7] || '',         // 색상
            price,                    // 가격
            rawData[9] || '',         // 옵션
            // 추가 데이터 (사고내역, 추가장착, 옵션내역 등)는 그대로 유지
            ...(rawData.slice(10) || [])
          ];
        });
      });

      allData = allData.concat(pageData);
      console.log(`페이지 ${currentPage}에서 ${pageData.length}개의 데이터 추출`);

      // 다음 페이지로 이동 (마지막 페이지가 아닌 경우)
      if (currentPage < totalPages) {
        console.log(`다음 페이지(${currentPage + 1})로 이동 시도...`);
        
        try {
          // 페이지 번호 클릭
          await page.evaluate((nextPage) => {
            const pageTds = document.querySelectorAll('.uc_cpage td');
            const targetTd = Array.from(pageTds).find(td => td.textContent.trim() === nextPage.toString());
            if (targetTd) {
              targetTd.click();
            } else {
              throw new Error(`페이지 ${nextPage} 버튼을 찾을 수 없습니다.`);
            }
          }, currentPage + 1);

          // 페이지 로딩 대기
          await page.waitForNavigation({ waitUntil: 'networkidle0' });
          await waitForTimeout(2000);

          // 데이터 로딩 확인
          const isDataLoaded = await page.evaluate(() => {
            const rows = document.querySelectorAll('table.uc_data tbody tr');
            return rows.length > 0;
          });

          if (!isDataLoaded) {
            console.log(`페이지 ${currentPage + 1} 데이터 로딩 실패, 재시도...`);
            currentPage--; // 현재 페이지 다시 시도
          }
        } catch (error) {
          console.log(`페이지 ${currentPage + 1} 이동 중 에러 발생:`, error.message);
          console.log('재시도...');
          currentPage--; // 현재 페이지 다시 시도
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