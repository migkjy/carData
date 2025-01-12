import time
import json
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.keys import Keys
import pandas as pd
from datetime import datetime

class CarManagerCrawler:
    def __init__(self):
        self.base_url = "https://carmanager.co.kr"
        self.login_url = f"{self.base_url}/User/Login"
        
        # Set up Firefox options
        self.options = Options()
        self.driver = webdriver.Firefox(
            service=Service('/usr/local/bin/geckodriver'),
            options=self.options
        )
        
        self.data = []

    def login(self, username, password):
        try:
            print("Navigating to login page...")
            self.driver.get(self.base_url)
            time.sleep(2)
            
            # Wait and click login button
            print("Looking for login button...")
            login_button = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "a.login"))
            )
            print("Clicking login button...")
            login_button.click()
            time.sleep(2)

            print("Entering credentials...")
            # Find and fill username field
            username_field = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "input#Id"))
            )
            username_field.clear()
            username_field.send_keys(username)

            # Find and fill password field
            password_field = self.driver.find_element(By.CSS_SELECTOR, "input#Password")
            password_field.clear()
            password_field.send_keys(password)

            # Submit the form
            print("Submitting login form...")
            submit_button = self.driver.find_element(By.CSS_SELECTOR, "button.btn.btn-primary")
            submit_button.click()

            # Wait for login to complete
            time.sleep(3)
            
            # Verify login success
            print("Verifying login status...")
            if "logout" in self.driver.current_url.lower() or "mypage" in self.driver.current_url.lower():
                print("Login verification successful!")
                return True
                
            # Alternative verification
            try:
                account_element = WebDriverWait(self.driver, 5).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, ".mypage, .logout, .user-info"))
                )
                print("Login verification successful!")
                return True
            except:
                print("Could not verify login success")
                return False

        except Exception as e:
            print(f"Login failed: {str(e)}")
            return False

    def get_page_data(self, page=1):
        try:
            # Navigate to the car management page
            url = f"{self.base_url}/Car/Management"
            if page > 1:
                url += f"?page={page}"
            
            self.driver.get(url)
            time.sleep(2)  # Wait for page to load

            # Wait for the table to be present
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "table.table"))
            )

            # Find all car rows in the table
            rows = self.driver.find_elements(By.CSS_SELECTOR, "table.table tbody tr")
            
            if not rows:
                print(f"No data found on page {page}")
                return []
            
            page_data = []
            for row in rows:
                try:
                    cells = row.find_elements(By.TAG_NAME, "td")
                    if not cells:
                        continue
                        
                    car_info = {
                        'date': cells[0].text if len(cells) > 0 else '',
                        'car_number': cells[1].text if len(cells) > 1 else '',
                        'car_name': cells[2].text if len(cells) > 2 else '',
                        'model_year': cells[3].text if len(cells) > 3 else '',
                        'mileage': cells[4].text if len(cells) > 4 else '',
                        'price': cells[5].text if len(cells) > 5 else '',
                        'status': cells[6].text if len(cells) > 6 else '',
                        'dealer': cells[7].text if len(cells) > 7 else '',
                        'location': cells[8].text if len(cells) > 8 else ''
                    }
                    page_data.append(car_info)
                except Exception as e:
                    print(f"Error parsing row: {str(e)}")
                    continue
            
            return page_data
        except Exception as e:
            print(f"Error getting page {page} data: {str(e)}")
            return []

    def crawl_all_pages(self, max_pages=None):
        page = 1
        while True:
            print(f"Crawling page {page}...")
            page_data = self.get_page_data(page)
            
            if not page_data:  # If no data is returned, we've reached the end
                print(f"No more data found after page {page-1}")
                break
                
            self.data.extend(page_data)
            print(f"Found {len(page_data)} cars on page {page}")
            
            if max_pages and page >= max_pages:
                print(f"Reached maximum pages limit ({max_pages})")
                break
            
            # Check if there's a next page button that's clickable
            try:
                next_button = self.driver.find_element(By.CSS_SELECTOR, "a.next-page")  # Adjust selector as needed
                if 'disabled' in next_button.get_attribute('class'):
                    print("Reached last page")
                    break
            except:
                # If we can't find the next page button, assume we're done
                print("No next page button found")
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
        summary = {
            'total_cars': len(self.data),
            'unique_dealers': len(df['dealer'].unique()),
            'average_price': df['price'].replace('', '0').astype(float).mean(),
            'timestamp': datetime.now().isoformat()
        }
        
        summary_file = os.path.join('data', f'summary_{timestamp}.json')
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        print(f"Summary saved to {summary_file}")
        
    def close(self):
        self.driver.quit()

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
    finally:
        # Always close the browser
        print("Closing browser...")
        crawler.close()

if __name__ == "__main__":
    main()