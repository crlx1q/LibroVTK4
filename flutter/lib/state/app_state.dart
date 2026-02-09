import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models.dart';
import '../services/api_client.dart';

class AppState extends ChangeNotifier {
  static const _defaultBaseUrl = 'http://212.227.64.179:10216';

  bool _initialized = false;
  bool _isOnline = true;
  ThemeMode _themeMode = ThemeMode.light;
  String _baseUrl = _defaultBaseUrl;
  String? _accessToken;
  String? _refreshToken;
  UserProfile? _user;
  String _currentView = 'catalog';

  late final ApiClient _api;

  bool get initialized => _initialized;
  bool get isOnline => _isOnline;
  ThemeMode get themeMode => _themeMode;
  String get baseUrl => _baseUrl;
  String? get accessToken => _accessToken;
  String? get refreshToken => _refreshToken;
  UserProfile? get user => _user;
  String get currentView => _currentView;

  Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString('accessToken');
    _refreshToken = prefs.getString('refreshToken');
    _baseUrl = prefs.getString('baseUrl') ?? _defaultBaseUrl;
    final theme = prefs.getString('theme');
    if (theme == 'dark') {
      _themeMode = ThemeMode.dark;
    }

    _api = ApiClient(
      baseUrl: _baseUrl,
      getAccessToken: () => _accessToken,
      getRefreshToken: () => _refreshToken,
      onAccessTokenUpdated: (token) async {
        _accessToken = token;
        await prefs.setString('accessToken', token);
        notifyListeners();
      },
      onUnauthorized: () async {
        await logout();
      },
    );

    await _updateConnectivity();
    Connectivity().onConnectivityChanged.listen((event) {
      _isOnline = event != ConnectivityResult.none;
      notifyListeners();
    });

    if (_accessToken != null && _accessToken!.isNotEmpty) {
      await fetchCurrentUser();
    }

    _initialized = true;
    notifyListeners();
  }

  Future<void> _updateConnectivity() async {
    final result = await Connectivity().checkConnectivity();
    _isOnline = result != ConnectivityResult.none;
  }

  Future<void> setBaseUrl(String url) async {
    _baseUrl = url.trim();
    _api.baseUrl = _baseUrl;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('baseUrl', _baseUrl);
    notifyListeners();
  }

  Future<void> toggleTheme() async {
    _themeMode = _themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('theme', _themeMode == ThemeMode.dark ? 'dark' : 'light');
    notifyListeners();
  }

  void setCurrentView(String view) {
    _currentView = view;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final data = await _api.postJson('/api/auth/login', {
      'email': email,
      'password': password,
    }, withAuth: false);
    _accessToken = data['accessToken']?.toString();
    _refreshToken = data['refreshToken']?.toString();
    final prefs = await SharedPreferences.getInstance();
    if (_accessToken != null) {
      await prefs.setString('accessToken', _accessToken!);
    }
    if (_refreshToken != null) {
      await prefs.setString('refreshToken', _refreshToken!);
    }
    await fetchCurrentUser();
  }

  Future<void> register({
    required String fullName,
    required String email,
    required String password,
    required String group,
    required String phone,
    required String iin,
  }) async {
    final data = await _api.postJson('/api/auth/register', {
      'fullName': fullName,
      'email': email,
      'password': password,
      'group': group,
      'phone': phone,
      'iin': iin,
    }, withAuth: false);
    _accessToken = data['accessToken']?.toString();
    _refreshToken = data['refreshToken']?.toString();
    final prefs = await SharedPreferences.getInstance();
    if (_accessToken != null) {
      await prefs.setString('accessToken', _accessToken!);
    }
    if (_refreshToken != null) {
      await prefs.setString('refreshToken', _refreshToken!);
    }
    await fetchCurrentUser();
  }

  Future<void> logout() async {
    try {
      await _api.postJson('/api/auth/logout', {}, withAuth: true);
    } catch (_) {}
    _accessToken = null;
    _refreshToken = null;
    _user = null;
    _currentView = 'catalog';
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('accessToken');
    await prefs.remove('refreshToken');
    notifyListeners();
  }

  Future<void> fetchCurrentUser() async {
    if (_accessToken == null || _accessToken!.isEmpty) return;
    try {
      final data = await _api.getJson('/api/student/me');
      _user = UserProfile.fromJson(data);
      if (_user != null) {
        _currentView = _user!.role == 'student'
            ? 'catalog'
            : _user!.role == 'librarian'
                ? 'librarian-books'
                : 'admin-users';
      }
    } on ApiException {
      _user = null;
    }
    notifyListeners();
  }

  Future<ChatOverview> fetchChatOverview() async {
    final data = await _api.getJson('/api/chats/rooms');
    return ChatOverview.fromJson(data);
  }

  Future<List<ChatMessage>> fetchChatMessages(String roomId) async {
    final data = await _api.getJson('/api/chats/rooms/$roomId/messages');
    final items = data['messages'] as List<dynamic>? ?? [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(ChatMessage.fromJson)
        .toList();
  }

  Future<String> createChatRoom(String userId) async {
    final data = await _api.postJson('/api/chats/rooms', {'userId': userId});
    return data['roomId']?.toString() ?? '';
  }

  Future<ChatMessage> sendChatMessage(String roomId, String text) async {
    final data = await _api.postJson('/api/chats/rooms/$roomId/messages', {'text': text});
    return ChatMessage.fromJson(data);
  }

  Future<Map<String, dynamic>> fetchCatalog({
    String search = '',
    String genre = '',
    String category = '',
    String sort = '',
    int page = 1,
    int limit = 12,
  }) async {
    final query = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (search.isNotEmpty) query['search'] = search;
    if (genre.isNotEmpty) query['genre'] = genre;
    if (category.isNotEmpty) query['category'] = category;
    if (sort.isNotEmpty) query['sort'] = sort;
    final uri = Uri(path: '/api/student/catalog', queryParameters: query).toString();
    return _api.getJson(uri);
  }

  Future<Book> fetchBookDetail(String id) async {
    final data = await _api.getJson('/api/student/books/$id');
    return Book.fromJson(data);
  }

  Future<void> requestBook(String bookId) async {
    await _api.postJson('/api/student/requests', {'bookId': bookId});
  }

  Future<List<StudentRequest>> fetchStudentRequests() async {
    final list = await _api.getList('/api/student/requests');
    return list.map((item) => StudentRequest.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<void> cancelRequest(String requestId) async {
    await _api.delete('/api/student/requests/$requestId');
  }

  Future<List<FavoriteItem>> fetchFavorites() async {
    final list = await _api.getList('/api/student/favorites');
    return list.map((item) => FavoriteItem.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<void> addFavorite(String bookId) async {
    await _api.postJson('/api/student/favorites', {'bookId': bookId});
  }

  Future<void> removeFavorite(String bookId) async {
    await _api.delete('/api/student/favorites/$bookId');
  }

  Future<List<Loan>> fetchStudentLoans() async {
    final list = await _api.getList('/api/student/loans');
    return list.map((item) => Loan.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<String> fetchStudentQr() async {
    final data = await _api.getJson('/api/student/qr');
    return data['qrCodeDataUrl']?.toString() ?? '';
  }

  Future<Map<String, dynamic>> createIssueQr(String bookId) async {
    return _api.postJson('/api/student/issue-qr', {'bookId': bookId});
  }

  Future<List<Book>> fetchLibrarianBooks() async {
    final list = await _api.getList('/api/librarian/books');
    return list.map((item) => Book.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<Book> createBook(Map<String, dynamic> payload) async {
    final data = await _api.postJson('/api/librarian/books', payload);
    return Book.fromJson(data);
  }

  Future<Book> updateBook(String id, Map<String, dynamic> payload) async {
    final response = await _api.put('/api/librarian/books/$id', payload);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return Book.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
    }
    throw ApiException('Не удалось обновить книгу');
  }

  Future<void> deleteBook(String id) async {
    await _api.delete('/api/librarian/books/$id');
  }

  Future<List<Loan>> fetchLibrarianLoans() async {
    final list = await _api.getList('/api/librarian/loans');
    return list.map((item) => Loan.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<void> issueLoan({required String bookId, required String studentId, String? dueDate}) async {
    await _api.postJson('/api/librarian/loans/issue', {
      'bookId': bookId,
      'studentId': studentId,
      'dueDate': dueDate,
    });
  }

  Future<void> returnLoan(String loanId) async {
    await _api.postJson('/api/librarian/loans/return/$loanId', {});
  }

  Future<List<StudentRequest>> fetchLibrarianRequests() async {
    final list = await _api.getList('/api/librarian/requests');
    return list.map((item) => StudentRequest.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<void> resolveRequest(String requestId, Map<String, dynamic> payload) async {
    await _api.postJson('/api/librarian/requests/$requestId/resolve', payload);
  }

  Future<List<UserProfile>> fetchAdminUsers({String role = '', String search = ''}) async {
    final query = <String, String>{};
    if (role.isNotEmpty) query['role'] = role;
    if (search.isNotEmpty) query['search'] = search;
    final uri = Uri(path: '/api/admin/users', queryParameters: query).toString();
    final list = await _api.getList(uri);
    return list.map((item) => UserProfile.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<UserProfile> createAdminUser(Map<String, dynamic> payload) async {
    final data = await _api.postJson('/api/admin/users', payload);
    return UserProfile.fromJson(data);
  }

  Future<UserProfile> updateAdminUser(String id, Map<String, dynamic> payload) async {
    final response = await _api.patch('/api/admin/users/$id', payload);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return UserProfile.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
    }
    throw ApiException('Не удалось обновить пользователя');
  }

  Future<List<Loan>> fetchAdminLoans() async {
    final list = await _api.getList('/api/admin/loans');
    return list.map((item) => Loan.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<AdminStats> fetchAdminStats() async {
    final data = await _api.getJson('/api/admin/stats');
    return AdminStats.fromJson(data);
  }

  Future<Map<String, dynamic>> resolveIssueQr(String code) async {
    final uri = Uri(path: '/api/librarian/resolve-issue-qr', queryParameters: {'code': code}).toString();
    return _api.getJson(uri);
  }

  Future<List<UserProfile>> fetchLibrarianStudents(String search) async {
    final uri = Uri(path: '/api/librarian/students', queryParameters: {'search': search}).toString();
    final list = await _api.getList(uri);
    return list.map((item) => UserProfile.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<Map<String, dynamic>> resolveGenericQr(String payload) async {
    final uri = Uri(path: '/api/qr/resolve', queryParameters: {'payload': payload}).toString();
    return _api.getJson(uri);
  }
}
