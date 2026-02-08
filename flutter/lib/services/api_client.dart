import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiClient {
  ApiClient({
    required this.baseUrl,
    required this.getAccessToken,
    required this.getRefreshToken,
    required this.onAccessTokenUpdated,
    required this.onUnauthorized,
  });

  String baseUrl;
  final String? Function() getAccessToken;
  final String? Function() getRefreshToken;
  final void Function(String accessToken) onAccessTokenUpdated;
  final Future<void> Function() onUnauthorized;

  Future<Map<String, dynamic>> postJson(String path, Map<String, dynamic> body,
      {bool withAuth = true}) async {
    final response = await _request(
      path,
      method: 'POST',
      body: jsonEncode(body),
      withAuth: withAuth,
    );
    return _decodeJson(response);
  }

  Future<Map<String, dynamic>> getJson(String path, {bool withAuth = true}) async {
    final response = await _request(path, method: 'GET', withAuth: withAuth);
    return _decodeJson(response);
  }

  Future<List<dynamic>> getList(String path, {bool withAuth = true}) async {
    final response = await _request(path, method: 'GET', withAuth: withAuth);
    return _decodeList(response);
  }

  Future<http.Response> delete(String path, {bool withAuth = true}) async {
    return _request(path, method: 'DELETE', withAuth: withAuth);
  }

  Future<http.Response> patch(String path, Map<String, dynamic> body, {bool withAuth = true}) async {
    return _request(path, method: 'PATCH', body: jsonEncode(body), withAuth: withAuth);
  }

  Future<http.Response> put(String path, Map<String, dynamic> body, {bool withAuth = true}) async {
    return _request(path, method: 'PUT', body: jsonEncode(body), withAuth: withAuth);
  }

  Future<http.Response> _request(String path,
      {required String method, String? body, bool withAuth = true}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (withAuth) {
      final accessToken = getAccessToken();
      if (accessToken != null && accessToken.isNotEmpty) {
        headers['Authorization'] = 'Bearer $accessToken';
      }
    }

    final url = Uri.parse('$baseUrl$path');
    final request = http.Request(method, url)
      ..headers.addAll(headers)
      ..body = body ?? '';

    final streamed = await request.send();
    final result = await http.Response.fromStream(streamed);
    if (result.statusCode == 401 && withAuth) {
      final refreshed = await _refreshToken();
      if (refreshed) {
        return _request(path, method: method, body: body, withAuth: withAuth);
      }
      await onUnauthorized();
    }
    return result;
  }

  Future<bool> _refreshToken() async {
    final refreshToken = getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) return false;
    final url = Uri.parse('$baseUrl/api/auth/refresh');
    final response = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refreshToken': refreshToken}),
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final token = data['accessToken']?.toString();
      if (token != null) {
        onAccessTokenUpdated(token);
        return true;
      }
    }
    return false;
  }

  Map<String, dynamic> _decodeJson(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) {
        return {};
      }
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw ApiException(_extractMessage(response), statusCode: response.statusCode);
  }

  List<dynamic> _decodeList(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) {
        return [];
      }
      return jsonDecode(response.body) as List<dynamic>;
    }
    throw ApiException(_extractMessage(response), statusCode: response.statusCode);
  }

  String _extractMessage(http.Response response) {
    try {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      return data['message']?.toString() ?? 'Ошибка запроса';
    } catch (_) {
      return 'Ошибка запроса';
    }
  }
}
