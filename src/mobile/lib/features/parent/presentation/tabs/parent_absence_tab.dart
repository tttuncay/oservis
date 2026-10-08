import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class ParentAbsenceTab extends StatefulWidget {
  const ParentAbsenceTab({super.key});

  @override
  State<ParentAbsenceTab> createState() => _ParentAbsenceTabState();
}

class _ParentAbsenceTabState extends State<ParentAbsenceTab> {
  String _selectedDirection = 'TÜM_GÜN'; // SABAH, AKSAM, TÜM_GÜN
  final _reasonController = TextEditingController();
  bool _isSubmitted = false;

  void _submitAbsence() {
    setState(() {
      _isSubmitted = true;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Devamsızlık bildirimi şoföre ve idareye iletildi.'),
        backgroundColor: AppTheme.successGreen,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Top Card info
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: AppTheme.primaryGradient,
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.event_busy_rounded, color: AppTheme.accentGold, size: 28),
                  SizedBox(width: 10),
                  Text(
                    'Hızlı Devamsızlık Bildirimi',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              SizedBox(height: 8),
              Text(
                'Çocuğunuz servisi kullanmayacağı günlerde önceden bildirim yaparak şoförün durakta beklemesini önleyebilirsiniz.',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // Form Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Öğrenci: Can Yılmaz (2-A)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              const SizedBox(height: 16),
              const Text('Hangi Sefer İçin Geçerli?', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppTheme.textSecondary)),
              const SizedBox(height: 10),
              Row(
                children: [
                  _buildDirectionChoice('Tüm Gün', 'TÜM_GÜN'),
                  const SizedBox(width: 8),
                  _buildDirectionChoice('Sadece Sabah', 'SABAH'),
                  const SizedBox(width: 8),
                  _buildDirectionChoice('Sadece Akşam', 'AKSAM'),
                ],
              ),
              const SizedBox(height: 20),
              TextField(
                controller: _reasonController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Açıklama (İsteğe Bağlı)',
                  hintText: 'Örn: Raporlu, aile ziyareti...',
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: _isSubmitted ? null : _submitAbsence,
                icon: const Icon(Icons.send_rounded, size: 18),
                label: Text(_isSubmitted ? 'Bildirildi (Teşekkürler)' : 'Devamsızlık Bildir'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDirectionChoice(String label, String value) {
    final isSelected = _selectedDirection == value;
    return Expanded(
      child: InkWell(
        onTap: () {
          setState(() {
            _selectedDirection = value;
          });
        },
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? AppTheme.primaryNavy : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isSelected ? Colors.white : AppTheme.textPrimary,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ),
      ),
    );
  }
}
