# Crowd View 

### Project Description
---
This project aims to use data obtained from wifi syslogs from buildings around the UMass Amherst campus to display a heatmap of the campus at a specific minute or hour in the day. In order to do this, raw data from previous years was processed and stored in CSV files containing information about devices and their connections to access points within the various buildings on campus. Through data manipulation and file reading, we created an API view using the Django web framework to display the necessary and relevant information regarding occupancy and trajectory for our front end to call and display on an interactive heatmap using the leaflet javascript library.

### Necessary Libraries
---
To run/test this fullstack on your own machine, you will need:
- Python 3 or higher
- Django 4.1 or higher
- Django REST Framework
- A virtual environment (i.e. using Conda or Pip)
- Scikit-learn
- Pytorch
- Pandas
- Joblib
- VSC Live Server extension

### How to Run
---
To run, simply ensure that you have the folder downloaded as it is. Next, to implement the proper scalers for the model, change the file path to fit the path on your machine. From there, make sure you are in the folder containing manage.py (crowdvisualrestapi_copy), and start the server with the command: "python manage.py runserver". To enable multiple connections on the same network, simply add your machine's IP address to the ALLLOWED_HOSTS in settings.py, and run: "python manage.py runserver X:8000", where X is your desired IP address. To start the visualization, right click on either prediction.html or occupancy.html, and click "Open with live server". Now, you should be able to see the application running!
