from django.urls import path
from .views import CampusAPI, BuildingAPI, AccessPointAPI, RouteAPI, PredictionAPI, CampusPredictionAPI
from django.http import JsonResponse

# Function-Based View for Testing
def simple_predict_view(request, datetime_str):
    if request.method == 'GET':
        return JsonResponse({"message": "GET request received", "datetime": datetime_str})
    return JsonResponse({"error": "Method not allowed"}, status=405)

urlpatterns = [
    path("campus/datetime/<str:datetime_str>/", CampusAPI.as_view(), name="campus-api"),
    path("building/<str:building>/datetime/<str:datetime_str>/", BuildingAPI.as_view(), name="building-api"),
    path("building/<str:building>/datetime/<str:datetime_str>/access_point/", AccessPointAPI.as_view(), name="access-poiont-api"),
    path("trajectory/<str:device_id>/date/<str:date_str>/", RouteAPI.as_view(), name="route-api"),
    path('predict/datetime/<str:datetime_str>/', PredictionAPI.as_view(), name='prediction-api'),
    path("predict/campus/datetime/<str:datetime_str>/", CampusPredictionAPI.as_view(), name="campus-prediction-api"),
]

