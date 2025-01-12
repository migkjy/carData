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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--display=:1'],
    executablePath: '/usr/bin/google-chrome'
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
    await page.goto('https://www.carmanager.co.kr/Car/Data', {
      waitUntil: 'networkidle0'
    });

    // 100개씩 보기 설정
    console.log('100개씩 보기 설정 중...');
    await waitForTimeout(2000);  // 페이지 완전 로드 대기
    
    // 드롭다운 클릭
    await page.click('.sbHolder');
    await waitForTimeout(1000);
    
    // 100개 옵션 클릭
    await page.evaluate(() => {
      const options = document.querySelectorAll('.sbOptions a');
      const option100 = Array.from(options).find(a => a.getAttribute('rel') === '100');
      if (option100) {
        option100.click();
      }
    });
    
    await waitForTimeout(2000);  // 설정 적용 대기

    // 페이지별 데이터 수집
    let currentPage = 1;
    while (currentPage <= 10) { // 최대 10페이지까지만 수집
      console.log(`페이지 ${currentPage} 처리 중...`);
      
      // 페이지 이동 (첫 페이지는 이미 로드됨)
      if (currentPage > 1) {
        await page.evaluate((pageNum) => {
          if (typeof goPageSubmit === 'function') {
            goPageSubmit(pageNum);
          }
        }, currentPage);
        await waitForTimeout(2000); // 페이지 로드 대기
      }
      
      // 데이터 로드 대기
      await waitForTimeout(2000);
      
      // 데이터 추출
      const pageData = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table.uc_data tbody tr'));
        return rows.map(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          return cells.map(cell => {
            let text = cell.textContent
              .replace(/\s+/g, ' ')  // 여러 공백을 하나로
              .trim();               // 앞뒤 공백 제거
            // CSV에서 문제될 수 있는 쉼표는 세미콜론으로 대체
            text = text.replace(/,/g, ';');
            return text;
          });
        });
      });
      
      if (pageData.length === 0) {
        console.log('더 이상 데이터가 없습니다.');
        break;
      }
      
      // 첫 페이지에서만 헤더 추가
      if (currentPage === 1) {
        const headers = [
          '날짜', '경과일', '차량', '변속기', '연식', '등록일', 
          '연료', '주행거리', '색상', '가격', '옵션', '지역'
        ];
        allData.push(headers);
      }
      
      allData = allData.concat(pageData);
      console.log(`${pageData.length}개의 데이터 추출 완료`);
      
      currentPage++;
    }

    // 데이터를 CSV 파일로 저장
    console.log('데이터를 CSV 파일로 저장 중...');
    const csvContent = allData.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    const filePath = 'carmanager_data.csv';
    fs.writeFileSync(filePath, csvContent);
    console.log(`총 ${allData.length}개의 데이터를 ${filePath} 파일에 저장했습니다.`);

  } catch (error) {
    console.error('에러 발생:', error);
  } finally {
    await browser.close();
  }
})();