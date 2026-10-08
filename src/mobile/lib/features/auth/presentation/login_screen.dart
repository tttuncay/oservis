import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/network/api_client.dart';
import '../../driver/presentation/driver_trip_screen.dart';
import '../../parent/presentation/parent_home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailOrPhoneController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;
  final _apiClient = ApiClient();

  Future<void> _handleLogin() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiClient.dio.post('/auth/login', data: {
        'emailOrPhone': _emailOrPhoneController.text.trim(),
        'password': _passwordController.text,
      });

      if (response.data['success'] == true) {
        final data = response.data['data'];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('access_token', data['accessToken']);
        await prefs.setString('tenant_id', data['tenantId'] ?? '');
        await prefs.setString('role', data['role'] ?? '');

        if (!mounted) return;

        final role = (data['role'] ?? '').toString().toUpperCase();
        if (role == 'DRIVER' || role == 'HOST') {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const DriverTripScreen()),
          );
        } else {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const ParentHomeScreen()),
          );
        }
      } else {
        setState(() {
          _errorMessage = response.data['message'] ?? 'Giriş başarısız.';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Giriş yapılamadı. Lütfen bilgilerinizi kontrol ediniz.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(
                  Icons.directions_bus_rounded,
                  size: 80,
                  color: Color(0xFF1E3A8A),
                ),
                const SizedBox(height: 16),
                const Text(
                  'OSERVIS',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 2,
                    color: Color(0xFF1E3A8A),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Öğrenci ve Okul Servis Yönetim Sistemi',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey, fontSize: 14),
                ),
                const SizedBox(height: 32),
                if (_errorMessage != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: TextStyle(color: Colors.red.shade800),
                    ),
                  ),
                TextField(
                  controller: _emailOrPhoneController,
                  decoration: const InputDecoration(
                    labelText: 'E-posta veya Telefon',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Şifre',
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text('Giriş Yap'),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () {
                    // Quick Demo as Driver
                    Navigator.of(context).pushReplacement(
                      MaterialPageRoute(builder: (_) => const DriverTripScreen()),
                    );
                  },
                  child: const Text('Demo Şoför Ekranını Aç'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
