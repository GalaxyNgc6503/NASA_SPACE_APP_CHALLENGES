# EventSky : AI driven trip planning app
Plan smarter, stay safe, and enjoy the outdoors with advanced weather probability forecasts.

# Problem Statement
Planning outdoor activities and events is often disrupted by unpredictable weather, and conventional long-term forecasts are limited in accuracy and scope. Individuals, organizers, and communities lack accessible tools that leverage historical climate records and advanced datasets to assess the probability of heat, cold, rainfall, strong winds, or general discomfort for a specific location and date. This gap makes it difficult to make informed decisions, manage weather-related risks, and understand potential impacts of climate variability and change.

# Solution
EventSky is a mobile app that leverages decades of historical climate data, including NASA POWER and GPM datasets, to estimate the probability of extreme weather conditions. Users select a location and date, and the app calculates averages, extremes, and exceedance probabilities, presenting results through clear, interactive visualizations such as probability bars, distribution plots, and maps. Data can be downloaded in CSV or JSON format with metadata and direct links to NASA sources.

# Impact
EventSky empowers individuals, event organizers, and communities to plan outdoor activities safely, manage weather risks, and better understand the potential impacts of climate variability. By transforming complex Earth observation data into actionable insights, the app supports proactive decision-making and reduces the risk of weather-related disruptions.

# Technology / Methodology
- Built as a mobile application for both iOS and Android.
- Uses historical climate and reanalysis datasets from NASA POWER and GPM.
- Processes data with Python and integrates APIs to calculate exceedance probabilities.
- Visualizations include interactive maps, probability bars, and distribution plots.
- Supports CSV and JSON downloads with metadata for further analysis.

### Installation
as this is only a development build it need some setup on computer to run.

#### On PC :
- nodejs development enviroment
- git

#### On Phone :
- Expo Go

after all of the requirement installed run in terminal :
```
git clone https://github.com/GalaxyNgc6503/NASA_SPACE_APP_CHALLENGES.git
npm install
```

To run the project run :
```
npx expo start
```

then scan the QR code with Expo Go

### Data Accuracy
Our weather data are base on historical data and a formula call [multiple linear regression](https://en.wikipedia.org/wiki/Linear_regression#Interpretation) 

# Prototype

# Future Improvement
- Expand to real-time weather alerts using live satellite feeds.
- Collaborate with local authorities to provide community-level risk insights.

# Team member
Ethen Lau Dee Hung – Lead developer, dataset integration, app architecture
Yong Men Jie – Data visualization, UX/UI design
Anson Wong Sie Xien – Backend development
Jotham Ling Hou Heng – Testing, documentation
Vincent Kong Yong Jun – Testing, documentation, user feedback
