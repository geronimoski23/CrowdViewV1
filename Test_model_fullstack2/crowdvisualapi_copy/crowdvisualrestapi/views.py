import torch
import pandas as pd
import joblib
from sklearn.preprocessing import StandardScaler
from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from .helper import campus_occupancy, get_csv, ap_occupancy, building_occupancy, time_and_date, trajectory_csv_data, device_traj
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from datetime import datetime
import os
from .consts import building_dict  # Import the building dictionary

# Define the EnhancedRNN model architecture
class EnhancedRNN(torch.nn.Module):
    def __init__(self, input_size, hidden_size, num_layers, output_size):
        super(EnhancedRNN, self).__init__()
        self.rnn = torch.nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc1 = torch.nn.Linear(hidden_size, hidden_size // 2)
        self.relu1 = torch.nn.ReLU()
        self.fc2 = torch.nn.Linear(hidden_size // 2, output_size)

    def forward(self, x):
        out, _ = self.rnn(x)
        out = self.fc1(out[:, -1, :])
        out = self.relu1(out)
        out = self.fc2(out)
        return out

# Load the model
model_path = '/path_to_your/occupancy_model2.pth'

input_size = 213  # Adjust based on the actual input size used during training
hidden_size = 128  # Same as used during training
num_layers = 2  # Same as used during training
output_size = 1  # Same as used during training

model = EnhancedRNN(input_size, hidden_size, num_layers, output_size)
model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
model.eval()

#load scaler
scaler_path = '/path_to_your/scaler.pkl'
scaler = joblib.load(scaler_path)
# Dummy data to fit the scaler (use representative data from training)
# Example features: hour_of_day, day_of_week, minute_of_day, future_day, week_of_year, is_weekend, building_one_hot
dummy_data = [
    [10, 1, 600, 70, 10, 0] + [0] * len(building_dict),
    [15, 2, 900, 71, 10, 0] + [0] * len(building_dict),
    [20, 3, 1200, 72, 10, 0] + [0] * len(building_dict)
    # Add more rows as needed
]

# Convert to DataFrame and fit the scaler
dummy_df = pd.DataFrame(dummy_data)
scaler = StandardScaler()
scaler.fit(dummy_df)

def index(request):
    return render(request, 'crowdvisualrestapi/index.html')

class CampusAPI(APIView):
    @swagger_auto_schema(
        operation_id='campus_occupancy',
        operation_summary='Campus View',
        tags=['Campus'],
        manual_parameters=[
            openapi.Parameter('datetime_str', openapi.IN_PATH, 
            description="""Date in simplified ISO 8601 date and time format 
            e.g. 2021-03-01T10:30 = March 1st, 2021 10:30 a.m.""", 
            type=openapi.TYPE_STRING),
            openapi.Parameter('granularity', openapi.IN_QUERY, 
            description="""Time Granularity (minute or hour) 
            If parameter is not specified, default is hour granularity""", 
            type=openapi.TYPE_STRING),
        ],
        responses={
            200: 'HTTP 200 OK',
            400: 'HTTP 400 Bad Request',
        }
    )
    def get(self, request, datetime_str, *args, **kwargs):
        if time_and_date(datetime_str) == "Invalid timestamp format":
            return Response({"error": "Invalid timestamp format"}, status=status.HTTP_400_BAD_REQUEST)
        date, timestamp = time_and_date(datetime_str)

        file = get_csv(date)
        if file == "error":
            return Response({"error": "Invalid Date"}, status=status.HTTP_400_BAD_REQUEST)

        if timestamp > 1440 or timestamp < 0:
            return Response({"error": "Invalid timestamp"}, status=status.HTTP_400_BAD_REQUEST)

        granularity = request.query_params.get('granularity')

        if not granularity or granularity == "hour":
            campus_data = campus_occupancy(file, timestamp, True)
            response = {
                "data": campus_data
            }
        elif granularity == "minute":
            campus_data = campus_occupancy(file, timestamp)
            response = {
                "data": campus_data
            }
        else:
            response = {
                "data": "Data Unavailable"
            }

        return Response(response, status=status.HTTP_200_OK)


          
class BuildingAPI(APIView):
    @swagger_auto_schema(
        operation_id='building_occupancy',
        operation_summary='Building View',
        tags=['Building'],
        manual_parameters=[
            openapi.Parameter('building', openapi.IN_PATH, 
            description="""Building on UMass Amherst Campus, in abbreviated form
            e.g. KNWL = Knowlton Hall""",
            type=openapi.TYPE_STRING),
            openapi.Parameter('datetime_str', openapi.IN_PATH, 
            description="""Date in simplified ISO 8601 date and time format 
            e.g. 2021-03-01T10:30 = March 1st, 2021 10:30 a.m.""", 
            type=openapi.TYPE_STRING),

            openapi.Parameter('granularity', openapi.IN_QUERY, 
            description="""Time Granularity (minute or hour) 
            If parameter is not specified, default is hour granularity""", 
            type=openapi.TYPE_STRING),
        ],
        responses={
            200: 'HTTP 200 OK',
            400: 'HTTP 400 Bad Request',
        }
    )
    def get(self, request, building, datetime_str, *args, **kwargs):
        if time_and_date(datetime_str) == "Invalid timestamp format":
            return Response({"error": "Invalid timestamp format"}, status=status.HTTP_400_BAD_REQUEST)
        date, timestamp = time_and_date(datetime_str)

        file = get_csv(date)
        if file == "error":
            return Response({"error": "Invalid Date"}, status=status.HTTP_400_BAD_REQUEST)

        if timestamp > 1440 or timestamp < 0:
            return Response({"error": "Invalid timestamp"}, status=status.HTTP_400_BAD_REQUEST)


        granularity = request.query_params.get('granularity')

        if not granularity or granularity == "hour":
            campus_data = building_occupancy(file, building, timestamp, True)
            response = {
                "data": campus_data
            }
        elif granularity == "minute":
            campus_data = building_occupancy(file, building, timestamp)
            response = {
                "data": campus_data
            }
        else:
            response = {
                "data": "Data Unavailable"
            }

        return Response(response, status=status.HTTP_200_OK)

class AccessPointAPI(APIView):
    @swagger_auto_schema(
        operation_id='access_point_occupancy',
        operation_summary='Access Point View',
        tags=['Access Point'],
        manual_parameters=[
            openapi.Parameter('datetime_str', openapi.IN_PATH, 
            description="""Date in simplified ISO 8601 date and time format 
            e.g. 2021-03-01T10:30 = March 1st, 2021 10:30 a.m.""", 
            type=openapi.TYPE_STRING),
            openapi.Parameter('building', openapi.IN_PATH, 
            description="Building abbreviation from UMass Amherst campus", 
            type=openapi.TYPE_STRING),
            openapi.Parameter('level', openapi.IN_QUERY, 
            description="""Floor Level
            If floor level not specified, default is 1st floor of building""", 
            type=openapi.TYPE_INTEGER),
            openapi.Parameter('granularity', openapi.IN_QUERY, 
            description="""Time Granularity (minute or hour) 
            If parameter is not specified, default is hour granularity""",
            type=openapi.TYPE_STRING),
        ],
        responses={
            200: 'HTTP 200 OK',
            400: 'HTTP 400 Bad Request',
        }
    )

    def get(self, request, datetime_str, building, *args, **kwargs):
        if time_and_date(datetime_str) == "Invalid timestamp format":
            return Response({"error": "Invalid timestamp format"}, status=status.HTTP_400_BAD_REQUEST)
        date, timestamp = time_and_date(datetime_str)

        file = get_csv(date)
        if file == "error":
            return Response({"error": "Invalid Date"}, status=status.HTTP_400_BAD_REQUEST)

        if timestamp > 1440 or timestamp < 0:
            return Response({"error": "Invalid timestamp"}, status=status.HTTP_400_BAD_REQUEST)


        level = request.query_params.get('level')
        granularity = request.query_params.get('granularity')
        

        if not level:
            if not granularity or granularity == "hour":
                data = ap_occupancy(file, building, timestamp, 1, True)
            else:
                data = ap_occupancy(file, building, timestamp, 1)
        else:
            floor = int(level)
            if not granularity or granularity == "hour":
                data = ap_occupancy(file, building, timestamp, floor, True)
            else:
                data = ap_occupancy(file, building, timestamp, floor)

        if data == "building_error":
            return Response({"error": "Invalid building name"}, status=status.HTTP_400_BAD_REQUEST)

        response = {
            'data': data
        }

        return Response(response, status=status.HTTP_200_OK)

class RouteAPI(APIView):
    @swagger_auto_schema(
        operation_id='user_trajectory',
        operation_summary='Trajectory Data',
        tags=['Trajectory'],
        manual_parameters=[
            openapi.Parameter('device_id', openapi.IN_PATH, 
            description="""Device id as read from csv file without "#" at the beginning and end
            e.g. Y4kGl.FiowcKk0z8xyTEjU instead of #Y4kGl.FiowcKk0z8xyTEjU#""", 
            type=openapi.TYPE_STRING),
            openapi.Parameter('date_str', openapi.IN_PATH, 
            description="""Date in simplified ISO 8601 date format 
            e.g. 2013-11-29 = November 29th, 2013""", 
            type=openapi.TYPE_STRING),
        ],
        responses={
            200: 'HTTP 200 OK',
            400: 'HTTP 400 Bad Request',
        }
    )

    def get(self, request, device_id, date_str, *args, **kwargs):
        if time_and_date(date_str) == "Invalid timestamp format":
            return Response({"error": "Invalid timestamp format"}, status=status.HTTP_400_BAD_REQUEST)
        date, timestamp = time_and_date(date_str)


        file = trajectory_csv_data(date)

        real_device_id = "#" + device_id + "#"
        response = {
                "data": device_traj(file, real_device_id)
            }      

        return Response(response, status=status.HTTP_200_OK)

class PredictionAPI(APIView):
    @swagger_auto_schema(
        operation_id='predict_occupancy',
        operation_summary='Predict Occupancy',
        tags=['Prediction'],
        manual_parameters=[
            openapi.Parameter('datetime_str', openapi.IN_PATH, 
            description="""Date in simplified ISO 8601 date and time format 
            e.g. 2021-03-01T10:30 = March 1st, 2021 10:30 a.m.""", 
            type=openapi.TYPE_STRING),
            openapi.Parameter('building', openapi.IN_QUERY, 
            description="Building name to predict occupancy for", 
            type=openapi.TYPE_STRING),
        ],
        responses={
            200: 'HTTP 200 OK',
            400: 'HTTP 400 Bad Request',
        }
    )
    def get(self, request, datetime_str, *args, **kwargs):
        result = time_and_date(datetime_str)
        if result == "Invalid timestamp format":
            return Response({"error": "Invalid timestamp format"}, status=status.HTTP_400_BAD_REQUEST)
        date_str, timestamp = result
        date = datetime.strptime(date_str, '%Y%m%d')

        building = request.query_params.get('building')
        if building not in building_dict:
            return Response({"error": "Invalid building name"}, status=status.HTTP_400_BAD_REQUEST)

        prediction_start_date = datetime(2021, 3, 9)
        future_day = (date - prediction_start_date).days

        if future_day < 0:
            return Response({"error": "Date must be on or after March 9, 2021"}, status=status.HTTP_400_BAD_REQUEST)

        hour_of_day = timestamp // 60
        day_of_week = (future_day % 7)
        minute_of_day = timestamp
        week_of_year = (future_day // 7) + 1
        is_weekend = 1 if day_of_week >= 5 else 0

        building_one_hot = [1 if building == b else 0 for b in building_dict]
        input_features = [
            hour_of_day,
            day_of_week,
            minute_of_day,
            future_day,
            week_of_year,
            is_weekend,
            *building_one_hot
        ]

        # Convert to DataFrame for scaling
        input_df = pd.DataFrame([input_features])

        # Scale the features
        input_scaled = scaler.transform(input_df)
        input_tensor = torch.tensor(input_scaled, dtype=torch.float32).unsqueeze(0)

        with torch.no_grad():
            prediction = model(input_tensor)
        prediction_value = prediction.numpy().tolist()

        # Round the prediction value to one decimal place
        prediction_value = [[round(val, 1) for val in sublist] for sublist in prediction_value]

        return Response({'prediction': prediction_value}, status=status.HTTP_200_OK)

class CampusPredictionAPI(APIView):
    @swagger_auto_schema(
        operation_id='predict_campus_occupancy',
        operation_summary='Predict Campus Occupancy',
        tags=['Prediction'],
        manual_parameters=[
            openapi.Parameter('datetime_str', openapi.IN_PATH, 
            description="""Date in simplified ISO 8601 date and time format 
            e.g. 2021-03-01T10:30 = March 1st, 2021 10:30 a.m.""", 
            type=openapi.TYPE_STRING),
        ],
        responses={
            200: 'HTTP 200 OK',
            400: 'HTTP 400 Bad Request',
        }
    )
    def get(self, request, datetime_str, *args, **kwargs):
        result = time_and_date(datetime_str)
        if result == "Invalid timestamp format":
            return Response({"error": "Invalid timestamp format"}, status=status.HTTP_400_BAD_REQUEST)
        date_str, timestamp = result
        date = datetime.strptime(date_str, '%Y%m%d')

        prediction_start_date = datetime(2021, 3, 9)
        future_day = (date - prediction_start_date).days

        if future_day < 0:
            return Response({"error": "Date must be on or after March 9, 2021"}, status=status.HTTP_400_BAD_REQUEST)

        hour_of_day = timestamp // 60
        day_of_week = (future_day % 7)
        minute_of_day = timestamp
        week_of_year = (future_day // 7) + 1
        is_weekend = 1 if day_of_week >= 5 else 0

        predictions = {}
        for building, (lat, long) in building_dict.items():
            building_one_hot = [1 if building == b else 0 for b in building_dict]
            input_features = [
                hour_of_day,
                day_of_week,
                minute_of_day,
                future_day,
                week_of_year,
                is_weekend,
                *building_one_hot
            ]

            input_df = pd.DataFrame([input_features])
            input_scaled = scaler.transform(input_df)
            input_tensor = torch.tensor(input_scaled, dtype=torch.float32).unsqueeze(0)

            with torch.no_grad():
                prediction = model(input_tensor)
            prediction_value = prediction.numpy().tolist()

            # Round the prediction value to two decimal place
            prediction_value = [[round(val, 2) for val in sublist] for sublist in prediction_value]

            predictions[building] = {
                'lat': lat,
                'long': long,
                'predicted_occupancy': prediction_value
            }



        return Response({'predictions': predictions}, status=status.HTTP_200_OK)
