from django.contrib import admin
from django.urls import path, include
from crowdvisualrestapi import views 
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from django.urls import path, re_path

schema_view = get_schema_view(
    openapi.Info(
        title="Crowd Visual API",
        default_version='v1',
        description="""The Crowd Visual API allows users to view campus and building occupancy of the UMass Amherst campus at specific dates and times.""" ,
        terms_of_service="https://www.google.com/policies/terms/",
        contact=openapi.Contact(email="contact@yourproject.local"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,)
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("crowdvisualrestapi.urls")),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
]
