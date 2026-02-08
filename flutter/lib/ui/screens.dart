import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final _searchController = TextEditingController();
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>> _load() {
    final appState = context.read<AppState>();
    return appState.fetchCatalog(search: _searchController.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async {
        setState(() => _future = _load());
        await _future;
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Каталог', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 12),
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              labelText: 'Поиск по названию или автору',
              suffixIcon: IconButton(
                icon: const Icon(Icons.search),
                onPressed: () => setState(() => _future = _load()),
              ),
            ),
            onSubmitted: (_) => setState(() => _future = _load()),
          ),
          const SizedBox(height: 16),
          FutureBuilder<Map<String, dynamic>>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return _ErrorState(error: snapshot.error.toString());
              }
              final data = snapshot.data ?? {};
              final items = (data['items'] as List<dynamic>? ?? [])
                  .map((item) => Book.fromJson(item as Map<String, dynamic>))
                  .toList();
              if (items.isEmpty) {
                return const _EmptyState(message: 'Книги не найдены');
              }
              return Column(
                children: items.map((book) => _BookCard(book: book)).toList(),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _BookCard extends StatelessWidget {
  const _BookCard({required this.book});

  final Book book;

  @override
  Widget build(BuildContext context) {
    final availability = '${book.availableCopies} из ${book.totalCopies}';
    final isAvailable = book.availableCopies > 0;
    final appState = context.read<AppState>();
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _CoverImage(url: book.cover),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(book.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      const SizedBox(height: 4),
                      Text('${book.author} · ${book.genre}'),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isAvailable ? Colors.green.withOpacity(0.15) : Colors.red.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          availability,
                          style: TextStyle(color: isAvailable ? Colors.green : Colors.red),
                        ),
                      ),
                    ],
                  ),
                )
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton(
                  onPressed: () => _showDetails(context, book.id),
                  child: const Text('Подробнее'),
                ),
                FilledButton(
                  onPressed: isAvailable
                      ? () async {
                          try {
                            await appState.requestBook(book.id);
                            _showSnack(context, 'Запрос отправлен');
                          } on ApiException catch (error) {
                            _showSnack(context, error.message);
                          }
                        }
                      : null,
                  child: const Text('Взять'),
                ),
                OutlinedButton.icon(
                  onPressed: () async {
                    try {
                      await appState.addFavorite(book.id);
                      _showSnack(context, 'Добавлено в избранное');
                    } on ApiException catch (error) {
                      _showSnack(context, error.message);
                    }
                  },
                  icon: const Icon(Icons.favorite_border),
                  label: const Text('В избранное'),
                ),
              ],
            )
          ],
        ),
      ),
    );
  }

  Future<void> _showDetails(BuildContext context, String bookId) async {
    final appState = context.read<AppState>();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) {
        return FutureBuilder<Book>(
          future: appState.fetchBookDetail(bookId),
          builder: (context, snapshot) {
            if (!snapshot.hasData) {
              return const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              );
            }
            final book = snapshot.data!;
            return Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(book.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text(book.author),
                  const SizedBox(height: 12),
                  Text(book.description.isNotEmpty ? book.description : 'Описание пока не добавлено.'),
                  const SizedBox(height: 12),
                  Text('Расположение: ${book.location.isNotEmpty ? book.location : 'не указано'}'),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () async {
                      try {
                        final result = await appState.createIssueQr(book.id);
                        if (context.mounted) {
                          Navigator.pop(context);
                          _showIssueQr(context, result);
                        }
                      } on ApiException catch (error) {
                        _showSnack(context, error.message);
                      }
                    },
                    child: const Text('Сгенерировать QR для выдачи'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showIssueQr(BuildContext context, Map<String, dynamic> data) {
    final qrDataUrl = data['qrCodeDataUrl']?.toString() ?? '';
    final issueCode = data['issueCode']?.toString() ?? '';
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('QR для выдачи'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _QrImage(dataUrl: qrDataUrl),
            const SizedBox(height: 12),
            Text('Код: $issueCode'),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Закрыть')),
        ],
      ),
    );
  }

  void _showSnack(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}

class StudentLoansScreen extends StatelessWidget {
  const StudentLoansScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.read<AppState>();
    return FutureBuilder<List<Loan>>(
      future: appState.fetchStudentLoans(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final loans = snapshot.data!;
        if (loans.isEmpty) {
          return const _EmptyState(message: 'Нет активных выдач');
        }
        return ListView(
          padding: const EdgeInsets.all(16),
          children: loans.map((loan) => _LoanCard(loan: loan)).toList(),
        );
      },
    );
  }
}

class FavoritesScreen extends StatelessWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.read<AppState>();
    return FutureBuilder<List<FavoriteItem>>(
      future: appState.fetchFavorites(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final favorites = snapshot.data!;
        if (favorites.isEmpty) {
          return const _EmptyState(message: 'Нет избранных книг');
        }
        return ListView(
          padding: const EdgeInsets.all(16),
          children: favorites.map((item) {
            final book = item.book;
            if (book == null) return const SizedBox.shrink();
            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                leading: _CoverImage(url: book.cover, size: 48),
                title: Text(book.title),
                subtitle: Text(book.author),
                trailing: IconButton(
                  icon: const Icon(Icons.favorite),
                  onPressed: () async {
                    await appState.removeFavorite(book.id);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Удалено')));
                    }
                  },
                ),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

class StudentRequestsScreen extends StatelessWidget {
  const StudentRequestsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.read<AppState>();
    return FutureBuilder<List<StudentRequest>>(
      future: appState.fetchStudentRequests(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final requests = snapshot.data!;
        if (requests.isEmpty) {
          return const _EmptyState(message: 'Нет активных запросов');
        }
        return ListView(
          padding: const EdgeInsets.all(16),
          children: requests.map((request) {
            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                title: Text(request.bookTitle),
                subtitle: Text('${request.bookAuthor} · ${request.bookLocation}'),
                trailing: request.status == 'pending'
                    ? TextButton(
                        onPressed: () async {
                          await appState.cancelRequest(request.id);
                          if (context.mounted) {
                            ScaffoldMessenger.of(context)
                                .showSnackBar(const SnackBar(content: Text('Запрос отменен')));
                          }
                        },
                        child: const Text('Отменить'),
                      )
                    : Text(request.status),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

class StudentQrScreen extends StatelessWidget {
  const StudentQrScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.read<AppState>();
    return FutureBuilder<String>(
      future: appState.fetchStudentQr(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final dataUrl = snapshot.data!;
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Ваш QR-код для библиотекаря'),
              const SizedBox(height: 16),
              _QrImage(dataUrl: dataUrl, size: 220),
            ],
          ),
        );
      },
    );
  }
}

class LibrarianBooksScreen extends StatefulWidget {
  const LibrarianBooksScreen({super.key});

  @override
  State<LibrarianBooksScreen> createState() => _LibrarianBooksScreenState();
}

class _LibrarianBooksScreenState extends State<LibrarianBooksScreen> {
  late Future<List<Book>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Book>> _load() {
    return context.read<AppState>().fetchLibrarianBooks();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openBookForm(context),
        child: const Icon(Icons.add),
      ),
      body: FutureBuilder<List<Book>>(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final books = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: books.map((book) => _LibrarianBookCard(
              book: book,
              onEdit: () => _openBookForm(context, book: book),
              onDelete: () async {
                await context.read<AppState>().deleteBook(book.id);
                setState(() => _future = _load());
              },
            )).toList(),
          );
        },
      ),
    );
  }

  Future<void> _openBookForm(BuildContext context, {Book? book}) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _BookForm(book: book),
    );
    if (result == true && mounted) {
      setState(() => _future = _load());
    }
  }
}

class _LibrarianBookCard extends StatelessWidget {
  const _LibrarianBookCard({required this.book, required this.onEdit, required this.onDelete});

  final Book book;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: _CoverImage(url: book.cover, size: 48),
        title: Text(book.title),
        subtitle: Text('${book.author} · ${book.availableCopies}/${book.totalCopies}'),
        trailing: PopupMenuButton<String>(
          onSelected: (value) {
            if (value == 'edit') {
              onEdit();
            } else if (value == 'delete') {
              onDelete();
            }
          },
          itemBuilder: (_) => [
            const PopupMenuItem(value: 'edit', child: Text('Редактировать')),
            const PopupMenuItem(value: 'delete', child: Text('Удалить')),
          ],
        ),
      ),
    );
  }
}

class LibrarianIssueScreen extends StatefulWidget {
  const LibrarianIssueScreen({super.key});

  @override
  State<LibrarianIssueScreen> createState() => _LibrarianIssueScreenState();
}

class _LibrarianIssueScreenState extends State<LibrarianIssueScreen> {
  final _codeController = TextEditingController();
  final _studentController = TextEditingController();
  final _bookController = TextEditingController();
  Map<String, dynamic>? _resolved;
  bool _loading = false;

  @override
  void dispose() {
    _codeController.dispose();
    _studentController.dispose();
    _bookController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Выдача по QR', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 16),
        TextField(
          controller: _codeController,
          decoration: const InputDecoration(labelText: 'Код из QR'),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _loading ? null : () => _resolveCode(context),
          child: _loading
              ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator())
              : const Text('Получить данные'),
        ),
        if (_resolved != null) ...[
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Студент: ${_resolved!["studentName"] ?? ""}'),
                  Text('Книга: ${_resolved!["bookTitle"] ?? ""}'),
                  Text('Группа: ${_resolved!["studentGroup"] ?? ""}'),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () => _issueLoan(context),
                    child: const Text('Выдать книгу'),
                  ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 24),
        Text('Ручная выдача', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        TextField(
          controller: _studentController,
          decoration: const InputDecoration(labelText: 'ID студента'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _bookController,
          decoration: const InputDecoration(labelText: 'ID книги'),
        ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () => _issueManual(context),
          child: const Text('Выдать вручную'),
        )
      ],
    );
  }

  Future<void> _resolveCode(BuildContext context) async {
    setState(() => _loading = true);
    try {
      final data = await context.read<AppState>().resolveIssueQr(_codeController.text.trim());
      setState(() => _resolved = data);
    } on ApiException catch (error) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _issueLoan(BuildContext context) async {
    if (_resolved == null) return;
    await context.read<AppState>().issueLoan(
          bookId: _resolved!["bookId"]?.toString() ?? '',
          studentId: _resolved!["studentId"]?.toString() ?? '',
        );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Книга выдана')));
      setState(() => _resolved = null);
    }
  }

  Future<void> _issueManual(BuildContext context) async {
    await context.read<AppState>().issueLoan(
          bookId: _bookController.text.trim(),
          studentId: _studentController.text.trim(),
        );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Книга выдана')));
    }
  }
}

class LibrarianLoansScreen extends StatelessWidget {
  const LibrarianLoansScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.read<AppState>();
    return FutureBuilder<List<Loan>>(
      future: appState.fetchLibrarianLoans(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final loans = snapshot.data!;
        if (loans.isEmpty) {
          return const _EmptyState(message: 'Нет текущих выдач');
        }
        return ListView(
          padding: const EdgeInsets.all(16),
          children: loans.map((loan) => Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              title: Text(loan.bookTitle),
              subtitle: Text('${loan.studentName} · ${loan.status}'),
              trailing: loan.status != 'возвращена'
                  ? TextButton(
                      onPressed: () async {
                        await appState.returnLoan(loan.id);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context)
                              .showSnackBar(const SnackBar(content: Text('Отмечено как возвращено')));
                        }
                      },
                      child: const Text('Возврат'),
                    )
                  : const Text('Возвращена'),
            ),
          )).toList(),
        );
      },
    );
  }
}

class LibrarianRequestsScreen extends StatelessWidget {
  const LibrarianRequestsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.read<AppState>();
    return FutureBuilder<List<StudentRequest>>(
      future: appState.fetchLibrarianRequests(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final requests = snapshot.data!;
        if (requests.isEmpty) {
          return const _EmptyState(message: 'Нет запросов');
        }
        return ListView(
          padding: const EdgeInsets.all(16),
          children: requests.map((request) => Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              title: Text(request.bookTitle),
              subtitle: Text('${request.studentName} · ${request.studentGroup}'),
              trailing: request.status == 'pending'
                  ? TextButton(
                      onPressed: () async {
                        await appState.resolveRequest(request.id, {'status': 'approved'});
                        if (context.mounted) {
                          ScaffoldMessenger.of(context)
                              .showSnackBar(const SnackBar(content: Text('Запрос обработан')));
                        }
                      },
                      child: const Text('Подтвердить'),
                    )
                  : Text(request.status),
            ),
          )).toList(),
        );
      },
    );
  }
}

class AdminUsersScreen extends StatefulWidget {
  const AdminUsersScreen({super.key});

  @override
  State<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends State<AdminUsersScreen> {
  final _searchController = TextEditingController();
  String _role = '';
  late Future<List<UserProfile>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<UserProfile>> _load() {
    return context.read<AppState>().fetchAdminUsers(role: _role, search: _searchController.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openUserForm(context),
        child: const Icon(Icons.person_add),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Пользователи', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 12),
          TextField(
            controller: _searchController,
            decoration: const InputDecoration(labelText: 'Поиск по имени или email'),
            onSubmitted: (_) => setState(() => _future = _load()),
          ),
          const SizedBox(height: 12),
          DropdownButton<String>(
            value: _role.isEmpty ? null : _role,
            hint: const Text('Фильтр роли'),
            items: const [
              DropdownMenuItem(value: 'student', child: Text('Студент')),
              DropdownMenuItem(value: 'librarian', child: Text('Библиотекарь')),
              DropdownMenuItem(value: 'admin', child: Text('Администратор')),
            ],
            onChanged: (value) {
              setState(() {
                _role = value ?? '';
                _future = _load();
              });
            },
          ),
          const SizedBox(height: 12),
          FutureBuilder<List<UserProfile>>(
            future: _future,
            builder: (context, snapshot) {
              if (!snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              final users = snapshot.data!;
              return Column(
                children: users.map((user) => Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    title: Text(user.fullName),
                    subtitle: Text('${user.email} · ${user.role}'),
                    trailing: Switch(
                      value: !user.blocked,
                      onChanged: (value) async {
                        await context.read<AppState>().updateAdminUser(user.id, {'blocked': !value});
                        setState(() => _future = _load());
                      },
                    ),
                  ),
                )).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  Future<void> _openUserForm(BuildContext context) async {
    final result = await showModalBottomSheet<UserProfile>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _UserForm(),
    );
    if (result != null && mounted) {
      setState(() => _future = _load());
    }
  }
}

class AdminStatsScreen extends StatelessWidget {
  const AdminStatsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<AdminStats>(
      future: context.read<AppState>().fetchAdminStats(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final stats = snapshot.data!;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Статистика', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _StatTile(label: 'Всего книг', value: stats.totalBooks.toString()),
                _StatTile(label: 'Выдано сегодня', value: stats.issuedToday.toString()),
                _StatTile(label: 'Выдано за неделю', value: stats.issuedWeek.toString()),
                _StatTile(label: 'Просрочки', value: stats.overdue.toString()),
              ],
            ),
            const SizedBox(height: 24),
            Text('Популярные книги', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            ...stats.popularBooks.map((item) => ListTile(
                  title: Text(item['title']?.toString() ?? ''),
                  trailing: Text('×${item['count']}'),
                )),
          ],
        );
      },
    );
  }
}

class AdminLoansScreen extends StatelessWidget {
  const AdminLoansScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.read<AppState>();
    return FutureBuilder<List<Loan>>(
      future: appState.fetchAdminLoans(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final loans = snapshot.data!;
        if (loans.isEmpty) {
          return const _EmptyState(message: 'Выдачи отсутствуют');
        }
        return ListView(
          padding: const EdgeInsets.all(16),
          children: loans.map((loan) => Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              title: Text(loan.bookTitle),
              subtitle: Text('${loan.studentName} · ${loan.status}'),
            ),
          )).toList(),
        );
      },
    );
  }
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _urlController = TextEditingController();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _urlController.text = context.read<AppState>().baseUrl;
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Сервер и настройки')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Адрес сервера'),
            const SizedBox(height: 8),
            TextField(
              controller: _urlController,
              decoration: const InputDecoration(labelText: 'http://10.0.2.2:3000'),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () async {
                await context.read<AppState>().setBaseUrl(_urlController.text);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Сохранено')));
                }
              },
              child: const Text('Сохранить'),
            ),
            const SizedBox(height: 16),
            const Text('Для Android эмулятора используйте 10.0.2.2'),
          ],
        ),
      ),
    );
  }
}

class _BookForm extends StatefulWidget {
  const _BookForm({this.book});

  final Book? book;

  @override
  State<_BookForm> createState() => _BookFormState();
}

class _BookFormState extends State<_BookForm> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _authorController = TextEditingController();
  final _yearController = TextEditingController();
  final _genreController = TextEditingController();
  final _categoryController = TextEditingController();
  final _coverController = TextEditingController();
  final _descController = TextEditingController();
  final _locationController = TextEditingController();
  final _copiesController = TextEditingController();
  final _inventoryController = TextEditingController();

  @override
  void initState() {
    super.initState();
    final book = widget.book;
    if (book != null) {
      _titleController.text = book.title;
      _authorController.text = book.author;
      _yearController.text = book.year;
      _genreController.text = book.genre;
      _categoryController.text = book.category;
      _coverController.text = book.cover;
      _descController.text = book.description;
      _locationController.text = book.location;
      _copiesController.text = book.totalCopies.toString();
      _inventoryController.text = book.inventoryNumber;
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _authorController.dispose();
    _yearController.dispose();
    _genreController.dispose();
    _categoryController.dispose();
    _coverController.dispose();
    _descController.dispose();
    _locationController.dispose();
    _copiesController.dispose();
    _inventoryController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.read<AppState>();
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(widget.book == null ? 'Новая книга' : 'Редактирование'),
              const SizedBox(height: 12),
              TextFormField(
                controller: _titleController,
                decoration: const InputDecoration(labelText: 'Название'),
                validator: (value) => value == null || value.isEmpty ? 'Введите название' : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _authorController,
                decoration: const InputDecoration(labelText: 'Автор'),
                validator: (value) => value == null || value.isEmpty ? 'Введите автора' : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _yearController,
                decoration: const InputDecoration(labelText: 'Год'),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _genreController,
                decoration: const InputDecoration(labelText: 'Жанр'),
                validator: (value) => value == null || value.isEmpty ? 'Введите жанр' : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _categoryController,
                decoration: const InputDecoration(labelText: 'Категория'),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _coverController,
                decoration: const InputDecoration(labelText: 'URL обложки'),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _locationController,
                decoration: const InputDecoration(labelText: 'Расположение'),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _copiesController,
                decoration: const InputDecoration(labelText: 'Кол-во копий'),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _inventoryController,
                decoration: const InputDecoration(labelText: 'Инвентарный номер'),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _descController,
                decoration: const InputDecoration(labelText: 'Описание'),
                maxLines: 3,
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () async {
                  if (!_formKey.currentState!.validate()) return;
                  final payload = {
                    'title': _titleController.text.trim(),
                    'author': _authorController.text.trim(),
                    'year': _yearController.text.trim(),
                    'genre': _genreController.text.trim(),
                    'category': _categoryController.text.trim(),
                    'cover': _coverController.text.trim(),
                    'description': _descController.text.trim(),
                    'location': _locationController.text.trim(),
                    'totalCopies': _copiesController.text.trim().isEmpty ? '1' : _copiesController.text.trim(),
                    'inventoryNumber': _inventoryController.text.trim(),
                  };
                  if (widget.book == null) {
                    await appState.createBook(payload);
                  } else {
                    await appState.updateBook(widget.book!.id, payload);
                  }
                  if (context.mounted) {
                    Navigator.pop(context, true);
                  }
                },
                child: const Text('Сохранить'),
              )
            ],
          ),
        ),
      ),
    );
  }
}

class _UserForm extends StatefulWidget {
  const _UserForm();

  @override
  State<_UserForm> createState() => _UserFormState();
}

class _UserFormState extends State<_UserForm> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  String _role = 'student';

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.read<AppState>();
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Новый пользователь'),
              const SizedBox(height: 12),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'ФИО'),
                validator: (value) => value == null || value.isEmpty ? 'Введите имя' : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _emailController,
                decoration: const InputDecoration(labelText: 'Email'),
                validator: (value) => value == null || value.isEmpty ? 'Введите email' : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _passwordController,
                decoration: const InputDecoration(labelText: 'Пароль'),
                validator: (value) => value == null || value.length < 6 ? 'Минимум 6 символов' : null,
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _role,
                items: const [
                  DropdownMenuItem(value: 'student', child: Text('Студент')),
                  DropdownMenuItem(value: 'librarian', child: Text('Библиотекарь')),
                  DropdownMenuItem(value: 'admin', child: Text('Администратор')),
                ],
                onChanged: (value) => setState(() => _role = value ?? 'student'),
                decoration: const InputDecoration(labelText: 'Роль'),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () async {
                  if (!_formKey.currentState!.validate()) return;
                  final payload = {
                    'fullName': _nameController.text.trim(),
                    'email': _emailController.text.trim(),
                    'password': _passwordController.text,
                    'role': _role,
                  };
                  final user = await appState.createAdminUser(payload);
                  if (context.mounted) {
                    Navigator.pop(context, user);
                  }
                },
                child: const Text('Создать'),
              )
            ],
          ),
        ),
      ),
    );
  }
}

class _LoanCard extends StatelessWidget {
  const _LoanCard({required this.loan});

  final Loan loan;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd.MM.yyyy');
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: _CoverImage(url: loan.book?.cover ?? '', size: 48),
        title: Text(loan.book?.title ?? loan.bookTitle),
        subtitle: Text('До ${_formatDate(loan.dueDate, dateFormat)}'),
        trailing: Text(loan.status),
      ),
    );
  }

  String _formatDate(String date, DateFormat format) {
    if (date.isEmpty) return '-';
    return format.format(DateTime.parse(date));
  }
}

class _CoverImage extends StatelessWidget {
  const _CoverImage({required this.url, this.size = 72});

  final String url;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (url.isEmpty) {
      return _placeholder();
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Image.network(
        url,
        width: size,
        height: size * 1.3,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _placeholder(),
      ),
    );
  }

  Widget _placeholder() {
    return Container(
      width: size,
      height: size * 1.3,
      decoration: BoxDecoration(
        color: Colors.blueGrey.withOpacity(0.2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Icon(Icons.menu_book),
    );
  }
}

class _QrImage extends StatelessWidget {
  const _QrImage({required this.dataUrl, this.size = 180});

  final String dataUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (dataUrl.isEmpty) {
      return const Text('QR не найден');
    }
    try {
      final base64Data = dataUrl.split(',').last;
      final bytes = base64Decode(base64Data);
      return Image.memory(Uint8List.fromList(bytes), width: size, height: size);
    } catch (_) {
      return const Text('Не удалось загрузить QR');
    }
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 160,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
          const SizedBox(height: 4),
          Text(label),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(child: Text(message));
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.error});

  final String error;

  @override
  Widget build(BuildContext context) {
    return Center(child: Text('Ошибка: $error'));
  }
}
