import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import 'landing_screen.dart';
import 'auth_screen.dart';
import 'screens.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    if (!appState.initialized) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (appState.user == null) {
      return LandingScreen(
        onLogin: () => _openAuth(context, AuthMode.login),
        onRegister: () => _openAuth(context, AuthMode.register),
      );
    }

    final navItems = _navigationForRole(appState.user!.role);
    final currentView = appState.currentView;
    final active = navItems.firstWhere(
      (item) => item.view == currentView,
      orElse: () => navItems.first,
    );

    return Scaffold(
      appBar: AppBar(
        title: _LogoImage(baseUrl: appState.baseUrl, size: 36),
        actions: [
          ConnectionChip(isOnline: appState.isOnline),
          IconButton(
            icon: Icon(appState.themeMode == ThemeMode.dark
                ? Icons.wb_sunny_outlined
                : Icons.nights_stay_outlined),
            onPressed: appState.toggleTheme,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: appState.logout,
          ),
        ],
      ),
      drawer: Drawer(
        child: SafeArea(
          child: Column(
            children: [
              _DrawerHeader(userName: appState.user!.fullName, role: appState.user!.role),
              Expanded(
                child: ListView(
                  children: navItems
                      .map(
                        (item) => ListTile(
                          leading: Icon(item.icon),
                          title: Text(item.label),
                          selected: currentView == item.view,
                          onTap: () {
                            Navigator.pop(context);
                            appState.setCurrentView(item.view);
                          },
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
          ),
        ),
      ),
      body: Column(
        children: [
          if (!appState.isOnline)
            const OfflineBanner(),
          Expanded(child: active.builder()),
        ],
      ),
    );
  }

  void _openAuth(BuildContext context, AuthMode mode) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => AuthScreen(initialMode: mode)),
    );
  }

  List<NavItem> _navigationForRole(String role) {
    if (role == 'student') {
      return [
        NavItem('catalog', 'Каталог', Icons.grid_view, () => const CatalogScreen()),
        NavItem('student-loans', 'Мои книги', Icons.book, () => const StudentLoansScreen()),
        NavItem('favorites', 'Избранное', Icons.favorite, () => const FavoritesScreen()),
        NavItem('student-requests', 'Запросы', Icons.notifications, () => const StudentRequestsScreen()),
        NavItem('student-qr', 'Мой QR', Icons.qr_code, () => const StudentQrScreen()),
        NavItem('chats', 'Чаты', Icons.chat_bubble_outline, () => const ChatsScreen()),
      ];
    }
    if (role == 'librarian') {
      return [
        NavItem('librarian-books', 'Книги', Icons.menu_book, () => const LibrarianBooksScreen()),
        NavItem('librarian-issue', 'Выдача по QR', Icons.qr_code_scanner, () => const LibrarianIssueScreen()),
        NavItem('librarian-loans', 'Текущие выдачи', Icons.assignment, () => const LibrarianLoansScreen()),
        NavItem('librarian-requests', 'Запросы', Icons.notifications_active, () => const LibrarianRequestsScreen()),
        NavItem('chats', 'Чаты', Icons.chat_bubble_outline, () => const ChatsScreen()),
      ];
    }
    return [
      NavItem('admin-users', 'Пользователи', Icons.people, () => const AdminUsersScreen()),
      NavItem('admin-stats', 'Статистика', Icons.bar_chart, () => const AdminStatsScreen()),
      NavItem('admin-loans', 'Все выдачи', Icons.layers, () => const AdminLoansScreen()),
      NavItem('chats', 'Чаты', Icons.chat_bubble_outline, () => const ChatsScreen()),
    ];
  }
}

class NavItem {
  NavItem(this.view, this.label, this.icon, this.builder);

  final String view;
  final String label;
  final IconData icon;
  final Widget Function() builder;
}

class ConnectionChip extends StatelessWidget {
  const ConnectionChip({super.key, required this.isOnline});

  final bool isOnline;

  @override
  Widget build(BuildContext context) {
    final color = isOnline ? Colors.green : Colors.red;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Icon(Icons.lightbulb, size: 24, color: color),
    );
  }
}

class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
      color: Colors.amber.withOpacity(0.2),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.wifi_off, size: 18),
          SizedBox(width: 8),
          Text('Оффлайн режим: показываем последние данные'),
        ],
      ),
    );
  }
}

class _DrawerHeader extends StatelessWidget {
  const _DrawerHeader({required this.userName, required this.role});

  final String userName;
  final String role;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFF2563EB), Color(0xFF60A5FA)]),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            userName,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
          ),
          const SizedBox(height: 4),
          Text(
            _roleLabel(role),
            style: TextStyle(color: Colors.white.withOpacity(0.9)),
          ),
        ],
      ),
    );
  }

  String _roleLabel(String role) {
    switch (role) {
      case 'student':
        return 'Студент';
      case 'librarian':
        return 'Библиотекарь';
      case 'admin':
        return 'Администратор';
      default:
        return role;
    }
  }
}

class _LogoImage extends StatelessWidget {
  const _LogoImage({required this.baseUrl, this.size = 32});

  final String baseUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Image.network(
        '$baseUrl/libro.png',
        width: size,
        height: size,
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => Icon(Icons.auto_stories, size: size),
      ),
    );
  }
}
