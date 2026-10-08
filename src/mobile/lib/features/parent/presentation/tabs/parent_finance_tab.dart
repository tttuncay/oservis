import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class ParentFinanceTab extends StatelessWidget {
  const ParentFinanceTab({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // 1. Premium Virtual Fee Card
        Container(
          height: 190,
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            gradient: AppTheme.primaryGradient,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: AppTheme.primaryNavy.withValues(alpha: 0.3),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    '2026-2027 Eğitim Yılı Servis Ücreti',
                    style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text('8 Taksit', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Kalan Bakiye', style: TextStyle(color: Colors.white70, fontSize: 12)),
                  SizedBox(height: 2),
                  Text('₺ 14.500,00', style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800)),
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Öğrenci: Can Yılmaz', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
                  Text('Ödenen: ₺ 6.000', style: TextStyle(color: AppTheme.accentGold.withValues(alpha: 0.9), fontWeight: FontWeight.bold, fontSize: 13)),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // 2. Instalment List
        const Text('Taksit Planı ve Ödemeler', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        const SizedBox(height: 12),

        _buildInstalmentTile('1. Taksit (Eylül)', '₺ 2.000,00', '15.09.2026', 'PAID'),
        _buildInstalmentTile('2. Taksit (Ekim)', '₺ 2.000,00', '15.10.2026', 'PAID'),
        _buildInstalmentTile('3. Taksit (Kasım)', '₺ 2.000,00', '15.11.2026', 'PENDING'),
        _buildInstalmentTile('4. Taksit (Aralık)', '₺ 2.000,00', '15.12.2026', 'PENDING'),
        _buildInstalmentTile('5. Taksit (Ocak)', '₺ 2.000,00', '15.01.2027', 'PENDING'),
      ],
    );
  }

  Widget _buildInstalmentTile(String title, String amount, String date, String status) {
    final isPaid = status == 'PAID';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: isPaid ? AppTheme.successGreen.withValues(alpha: 0.1) : const Color(0xFFF1F5F9),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isPaid ? Icons.check_circle_rounded : Icons.schedule_rounded,
                  color: isPaid ? AppTheme.successGreen : AppTheme.textSecondary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  Text('Vade: $date', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                ],
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(amount, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              Text(
                isPaid ? 'Ödendi' : 'Bekliyor',
                style: TextStyle(
                  color: isPaid ? AppTheme.successGreen : Colors.orange,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
