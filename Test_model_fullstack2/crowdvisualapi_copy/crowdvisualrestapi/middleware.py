import logging

logger = logging.getLogger(__name__)

class RequestLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        logger.info(f"Request path: {request.path}, method: {request.method}")
        response = self.get_response(request)
        return response
