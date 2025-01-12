import requests
import json
import pandas as pd
from datetime import datetime
import os
from bs4 import BeautifulSoup
import time

class CarManagerCrawler:
    def __init__(self):
        self.base_url = "https://carmanager.co.kr"
        self.session = requests.Session()
        self.data = []
        
    def login(self, username, password):
        try:
            print("Starting login process...")
            
            # First get the login page to get any necessary tokens
            login_url = f"{self.base_url}/User/Login"
            response = self.session.get(login_url)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Get CSRF token if any
            csrf_token = soup.find('input', {'name': '__RequestVerificationToken'})
            if csrf_token:
                login_data['__RequestVerificationToken'] = csrf_token.get('value', '')
                
            # Prepare login data
            login_data = {
                'Id': username,
                'Password': password,
            }
            
            print("Submitting login form...")
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': login_url,
                'Origin': self.base_url,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            
            response = self.session.post(
                login_url,
                data=login_data,
                headers=headers,
                allow_redirects=True
            )
            
            # Verify login success
            if "로그아웃" in response.text or "마이페이지" in response.text:
                print("Login successful!")
                return True
            else:
                print("Login verification failed")
                return False
                
        except Exception as e:
            print(f"Login failed: {str(e)}")
            return False
            
    def get_page_data(self, page=1):
        try:
            # Get the car search page
            url = f"{self.base_url}/Car/Search"
            if page > 1:
                url += f"?page={page}"
                
            response = self.session.get(url)
            if response.status_code != 200:
                print(f"Failed to get page {page}: {response.status_code}")
                return []
                
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find all car items
            car_items = soup.find_all('div', {'class': 'car-item'})
            if not car_items:
                print(f"No car items found on page {page}")
                return []

            page_data = []
            for item in car_items:
                try:
                    # Get basic info
                    title = item.find('div', {'class': 'car-title'})
                    price = item.find('div', {'class': 'car-price'})
                    info = item.find('div', {'class': 'car-info'})
                    details = item.find('div', {'class': 'car-details'})
                    
                    car_info = {
                        'title': title.text.strip() if title else '',
                        'price': price.text.strip() if price else '',
                        'info': info.text.strip() if info else '',
                        'details': details.text.strip() if details else '',
                    }
                    
                    # Try to extract more detailed information
                    if info:
                        info_text = info.text.strip()
                        info_parts = info_text.split('|')
                        car_info.update({
                            'year': info_parts[0].strip() if len(info_parts) > 0 else '',
                            'mileage': info_parts[1].strip() if len(info_parts) > 1 else '',
                            'fuel_type': info_parts[2].strip() if len(info_parts) > 2 else ''
                        })
                    page_data.append(car_info)
                except Exception as e:
                    print(f"Error parsing row: {str(e)}")
                    continue
                    
            return page_data
            
        except Exception as e:
            print(f"Error getting page {page} data: {str(e)}")
            return []
            
    def has_next_page(self, page):
        try:
            url = f"{self.base_url}/Car/Management"
            if page > 1:
                url += f"?page={page}"
                
            response = self.session.get(url)
            if response.status_code != 200:
                return False
                
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Look for pagination elements
            pagination = soup.find('ul', {'class': 'pagination'})
            if not pagination:
                return False
                
            # Check if current page is the last page
            next_link = pagination.find('a', {'class': 'next'})
            if not next_link or 'disabled' in next_link.get('class', []):
                return False
                
            return True
            
        except Exception as e:
            print(f"Error checking next page: {str(e)}")
            return False
            
    def crawl_all_pages(self, max_pages=None):
        page = 1
        while True:
            print(f"Crawling page {page}...")
            page_data = self.get_page_data(page)
            
            if not page_data:
                print(f"No more data found after page {page-1}")
                break
                
            self.data.extend(page_data)
            print(f"Found {len(page_data)} cars on page {page}")
            
            if max_pages and page >= max_pages:
                print(f"Reached maximum pages limit ({max_pages})")
                break
                
            if not self.has_next_page(page):
                print("Reached last page")
                break
                
            page += 1
            time.sleep(1)  # Be nice to the server
            
    def save_to_csv(self, filename=None):
        if not filename:
            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"car_data_{timestamp}.csv"
            
        # Create data directory if it doesn't exist
        os.makedirs('data', exist_ok=True)
        filepath = os.path.join('data', filename)
        
        # Convert to DataFrame and save
        df = pd.DataFrame(self.data)
        df.to_csv(filepath, index=False, encoding='utf-8-sig')
        print(f"Data saved to {filepath}")
        print(f"Total cars collected: {len(self.data)}")
        
        # Save summary statistics
        try:
            summary = {
                'total_cars': len(self.data),
                'unique_dealers': len(df['dealer'].unique()),
                'timestamp': datetime.now().isoformat()
            }
            
            try:
                summary['average_price'] = df['price'].str.replace(',', '').str.replace('만원', '').astype(float).mean()
            except:
                summary['average_price'] = 'N/A'
            
            summary_file = os.path.join('data', f'summary_{timestamp}.json')
            with open(summary_file, 'w', encoding='utf-8') as f:
                json.dump(summary, f, ensure_ascii=False, indent=2)
            print(f"Summary saved to {summary_file}")
        except Exception as e:
            print(f"Error saving summary: {str(e)}")

def main():
    # Set up the crawler
    print("Initializing CarManager Crawler...")
    crawler = CarManagerCrawler()
    
    try:
        # Login
        print("Attempting to login...")
        if crawler.login("pjec0000", "kl1110!!"):
            print("Login successful!")
            
            # Crawl all pages
            print("Starting data collection...")
            crawler.crawl_all_pages()
            
            # Save the data
            print("Saving collected data...")
            crawler.save_to_csv()
            
            print("Data collection completed successfully!")
        else:
            print("Login failed. Please check your credentials.")
    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    main()