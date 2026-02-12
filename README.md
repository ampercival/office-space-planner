# Office Space Planner 🏢

A web-based **Monte Carlo simulation tool** designed to help hybrid workplaces optimize their desk capacity. By simulating thousands of potential weeks, this tool provides data-driven recommendations on how many desks are actually needed to support a flexible workforce.

## 🚀 Features

-   **Monte Carlo Simulation**: Runs anywhere from 10 to 100,000 simulations to generate statistically significant results.
-   **Customizable Parameters**:
    -   **Total Employees**: Scale from small startups to large enterprises.
    -   **Days in Office**: Configure the expected hybrid schedule (e.g., 3 or 4 days per week).
    -   **Absenteeism Rate**: Factor in sick leave, PTO, and other absences.
-   **Key Insights**:
    -   **Average Daily Occupancy**: The typical number of people in the office.
    -   **Average Busiest Day**: The average peak occupancy observed in a typical week.
    -   **95% Confidence Recommendation**: A desk count that covers 95% of all simulated scenarios.
-   **Visual Analysis**: Interactive histogram showing the probability distribution of desk requirements.
-   **Real-time Progress**: Visual progress bar and time estimation for large simulations.

## 🛠️ How to Run

No installation or build process is required! This is a static web application.

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/officespace.git
    ```
2.  Navigate to the project folder:
    ```bash
    cd officespace
    ```
3.  Open `index.html` in your preferred web browser.

## 📊 How It Works

The simulation uses the **Monte Carlo method** to embrace randomness:

1.  **Weekly Schedule Generation**: For every employee, the system randomly assigns "Days in Office" based on your input (e.g., random 4 days out of 5).
2.  **Absenteeism Check**: For every scheduled day, a random check is performed against the absenteeism rate to see if the employee actually shows up.
3.  **Peak Detection**: For each simulated week, the system identifies the "Busiest Day" (highest occupancy).
4.  **Aggregation**: This process is repeated thousands of times to build a probability distribution, allowing you to make informed decisions based on risk tolerance (e.g., targeting the 95th percentile).

## 💻 Tech Stack

-   **HTML5 / CSS3**: Modern, responsive layout using CSS Grid and Flexbox.
-   **JavaScript (ES6+)**: Asynchronous simulation logic with non-blocking UI updates.
-   **Chart.js**: For rendering the beautiful and interactive data visualizations.
-   **Google Fonts**: Uses 'Outfit' for a clean, modern aesthetic.

## 📝 License

This project is open source and available under the [MIT License](LICENSE).
