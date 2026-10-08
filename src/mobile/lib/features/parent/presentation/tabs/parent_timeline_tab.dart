import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class ParentTimelineTab extends StatelessWidget {
  const ParentTimelineTab({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Morning Card
        _buildTripCard(
          context: context,
          title: 'Sabah Servisi (Okula Gidiş)',
          vehicle: '34 ABC 123',
          time: 'Bugün, 08 Ekim 2026',
          events: [
            _TimelineItem(time: '07:30', title: 'Servis Harekete Geçti', subtitle: 'Kadıköy Atatürk İlkokulu', isDone: true),
            _TimelineItem(time: '07:48', title: 'Öğrenci Servise Bindi', subtitle: 'Rasimpaşa Mah. Rıhtım Cad.', isDone: true, isHighlight: true),
            _TimelineItem(time: '08:15', title: 'Okula Güvenle Ulaştı', subtitle: 'Hostes eşliğinde teslim edildi', isDone: true),
            _TimelineItem(time: '08:18', title: 'Araç İçi Sweep Tamamlandı', subtitle: 'Araçta çocuk kalmadığı onaylandı', isDone: true, isSweep: true),
          ],
        ),

        const SizedBox(height: 20),

        // Afternoon Card
        _buildTripCard(
          context: context,
          title: 'Akşam Servisi (Eve Dönüş)',
          vehicle: '34 ABC 123',
          time: 'Bugün, 15:30',
          events: [
            _TimelineItem(time: '15:30', title: 'Okuldan Hareket Bekleniyor', subtitle: 'Ders bitiş saati: 15:30', isDone: false),
            _TimelineItem(time: '16:05', title: 'Tahmini Eve Varış', subtitle: 'Rasimpaşa Mah. Rıhtım Cad.', isDone: false),
          ],
        ),
      ],
    );
  }

  Widget _buildTripCard({
    required BuildContext context,
    required String title,
    required String vehicle,
    required String time,
    required List<_TimelineItem> events,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.primaryNavy.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(vehicle, style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.primaryNavy, fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(time, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const SizedBox(height: 20),

          // Timeline steps
          ...events.map((event) => _buildStep(event)),
        ],
      ),
    );
  }

  Widget _buildStep(_TimelineItem item) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: item.isSweep 
                    ? Colors.orange 
                    : item.isDone 
                        ? AppTheme.successGreen 
                        : const Color(0xFFCBD5E1),
              ),
              child: Icon(
                item.isSweep ? Icons.shield_rounded : (item.isDone ? Icons.check : Icons.circle),
                size: 13,
                color: Colors.white,
              ),
            ),
            Container(
              width: 2,
              height: 36,
              color: const Color(0xFFE2E8F0),
            ),
          ],
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    item.title,
                    style: TextStyle(
                      fontWeight: item.isHighlight ? FontWeight.w800 : FontWeight.w600,
                      fontSize: 14,
                      color: item.isHighlight ? AppTheme.primaryNavy : AppTheme.textPrimary,
                    ),
                  ),
                  Text(item.time, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textSecondary)),
                ],
              ),
              Text(item.subtitle, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ],
    );
  }
}

class _TimelineItem {
  final String time;
  final String title;
  final String subtitle;
  final bool isDone;
  final bool isHighlight;
  final bool isSweep;

  _TimelineItem({
    required this.time,
    required this.title,
    required this.subtitle,
    required this.isDone,
    this.isHighlight = false,
    this.isSweep = false,
  });
}
