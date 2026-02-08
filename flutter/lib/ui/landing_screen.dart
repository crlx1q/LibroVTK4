import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';

class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key, required this.onLogin, required this.onRegister});

  final VoidCallback onLogin;
  final VoidCallback onRegister;

  @override
  Widget build(BuildContext context) {
    final baseUrl = context.watch<AppState>().baseUrl;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.topCenter,
            radius: 1.2,
            colors: [
              Color(0x332563EB),
              Colors.transparent,
            ],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _LogoImage(baseUrl: baseUrl, size: 56),
                    const SizedBox(width: 12),
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Библиотека ВТК',
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        SizedBox(height: 2),
                        Text('Учет фонда и выдач'),
                      ],
                    )
                  ],
                ),
                const SizedBox(height: 32),
                const Text(
                  'Современная\nБиблиотека',
                  style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Цифровая платформа для управления библиотечным фондом ВТК. Быстрый поиск, электронные читательские билеты и мгновенная выдача книг.',
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: onLogin,
                  icon: const Icon(Icons.arrow_forward),
                  label: const Text('Войти'),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: onRegister,
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                  ),
                  child: const Text('Создать аккаунт'),
                ),
                const SizedBox(height: 32),
                Wrap(
                  spacing: 16,
                  runSpacing: 16,
                  children: const [
                    _StatCard(title: '1000+', subtitle: 'Книг в каталоге'),
                    _StatCard(title: '500+', subtitle: 'Читателей'),
                    _StatCard(title: '24/7', subtitle: 'Доступ онлайн'),
                  ],
                ),
                const SizedBox(height: 32),
                _PhonePreview(baseUrl: baseUrl),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      width: 160,
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
          const SizedBox(height: 4),
          Text(subtitle),
        ],
      ),
    );
  }
}

class _PhonePreview extends StatelessWidget {
  const _PhonePreview({required this.baseUrl});

  final String baseUrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 20,
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _LogoImage(baseUrl: baseUrl, size: 28),
              const SizedBox(width: 8),
              const Text('LibroVTK', style: TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 16),
          const Text('Каталог', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          const Text('Сегодня в библиотеке'),
          const SizedBox(height: 16),
          _PreviewBookCard(
            title: 'Красная книга Казахстана',
            author: 'Коллектив авторов',
            status: 'В наличии',
            statusColor: Colors.green,
          ),
          const SizedBox(height: 12),
          _PreviewBookCard(
            title: 'Слова назидания',
            author: 'Абай Кунанбаев',
            status: 'До 20 фев',
            statusColor: Colors.orange,
          ),
        ],
      ),
    );
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

class _PreviewBookCard extends StatelessWidget {
  const _PreviewBookCard({
    required this.title,
    required this.author,
    required this.status,
    required this.statusColor,
  });

  final String title;
  final String author;
  final String status;
  final Color statusColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.4),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 64,
            decoration: BoxDecoration(
              color: Colors.blueGrey.shade100,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.menu_book),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
                Text(author),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(status, style: TextStyle(color: statusColor, fontSize: 12)),
                ),
              ],
            ),
          )
        ],
      ),
    );
  }
}
