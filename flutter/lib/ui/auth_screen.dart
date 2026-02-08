import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../services/api_client.dart';

enum AuthMode { login, register }

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.initialMode});

  final AuthMode initialMode;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  late AuthMode _mode;
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _groupController = TextEditingController();
  final _phoneController = TextEditingController();
  final _iinController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _mode = widget.initialMode;
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    _groupController.dispose();
    _phoneController.dispose();
    _iinController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(
        title: Text(_mode == AuthMode.login ? 'Вход' : 'Регистрация'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _mode == AuthMode.login ? 'Добро пожаловать' : 'Создать аккаунт',
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                _mode == AuthMode.login
                    ? 'Войдите, чтобы управлять библиотекой'
                    : 'Получите читательский билет в пару кликов',
              ),
              const SizedBox(height: 24),
              Form(
                key: _formKey,
                child: Column(
                  children: [
                    if (_mode == AuthMode.register)
                      TextFormField(
                        controller: _nameController,
                        decoration: const InputDecoration(labelText: 'ФИО'),
                        validator: (value) => value == null || value.isEmpty ? 'Введите имя' : null,
                      ),
                    if (_mode == AuthMode.register) const SizedBox(height: 12),
                    TextFormField(
                      controller: _emailController,
                      decoration: const InputDecoration(labelText: 'Email'),
                      keyboardType: TextInputType.emailAddress,
                      validator: (value) => value == null || value.isEmpty ? 'Введите email' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _passwordController,
                      decoration: const InputDecoration(labelText: 'Пароль'),
                      obscureText: true,
                      validator: (value) => value == null || value.length < 6 ? 'Минимум 6 символов' : null,
                    ),
                    if (_mode == AuthMode.register) ...[
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _groupController,
                        decoration: const InputDecoration(labelText: 'Группа'),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _phoneController,
                        decoration: const InputDecoration(labelText: 'Телефон'),
                        keyboardType: TextInputType.phone,
                        validator: (value) => value == null || value.isEmpty ? 'Введите телефон' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _iinController,
                        decoration: const InputDecoration(labelText: 'ИИН'),
                        validator: (value) => value == null || value.isEmpty ? 'Введите ИИН' : null,
                      ),
                    ],
                    const SizedBox(height: 20),
                    if (_error != null)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.red.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(_error!, style: const TextStyle(color: Colors.red)),
                      ),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _loading
                            ? null
                            : () => _submit(appState),
                        child: _loading
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator())
                            : Text(_mode == AuthMode.login ? 'Войти' : 'Зарегистрироваться'),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(_mode == AuthMode.login
                      ? 'Нет аккаунта?'
                      : 'Уже есть аккаунт?'),
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _mode = _mode == AuthMode.login ? AuthMode.register : AuthMode.login;
                        _error = null;
                      });
                    },
                    child: Text(_mode == AuthMode.login ? 'Регистрация' : 'Войти'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text('Сервер: ${appState.baseUrl}', style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit(AppState appState) async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (_mode == AuthMode.login) {
        await appState.login(_emailController.text.trim(), _passwordController.text);
      } else {
        await appState.register(
          fullName: _nameController.text.trim(),
          email: _emailController.text.trim(),
          password: _passwordController.text,
          group: _groupController.text.trim(),
          phone: _phoneController.text.trim(),
          iin: _iinController.text.trim(),
        );
      }
      if (mounted) {
        Navigator.pop(context);
      }
    } on ApiException catch (error) {
      setState(() {
        _error = error.message;
      });
    } catch (_) {
      setState(() {
        _error = 'Не удалось выполнить запрос';
      });
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }
}
