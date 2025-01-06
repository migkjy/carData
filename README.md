# Car Data Crawler

자동차 데이터 수집을 위한 웹 크롤러입니다.

## 기능

- carmanager.co.kr 사이트에서 자동차 데이터를 자동으로 수집
- 수집된 데이터를 CSV 파일로 저장
- 페이지네이션 자동 처리 (한 페이지당 100개 데이터)

## 환경변수 설정

1. `.env.example` 파일을 `.env`로 복사합니다:
```bash
cp .env.example .env
```

2. `.env` 파일을 열어 실제 값으로 수정합니다:
```
CARMANAGER_USERNAME=your_username
CARMANAGER_PASSWORD=your_password
```

## 설치 방법

```bash
# 저장소 클론
git clone https://github.com/migkjy/carData.git

# 의존성 설치
npm install
```

## 사용 방법

```bash
# 프로그램 실행
npm start
```

## 주의사항

- 실행하기 전에 carmanager.co.kr 계정이 필요합니다.
- 데이터는 'carmanager_data.csv' 파일로 저장됩니다.