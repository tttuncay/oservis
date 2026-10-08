import 'package:flutter/material.dart';
import '../../../../core/services/tracking_service.dart';
import '../../../../core/theme/app_theme.dart';

class ParentLiveTrackingTab extends StatefulWidget {
  const ParentLiveTrackingTab({super.key});

  @override
  State<ParentLiveTrackingTab> createState() => _ParentLiveTrackingTabState();
}

class _ParentLiveTrackingTabState extends State<ParentLiveTrackingTab> {
  final TrackingService _trackingService = TrackingService();
  double _lat = 40.9920;
  double _lng = 29.0280;
  double _speed = 38.0;
  final String _etaMinutes = '6 dk';
  final int _remainingStops = 2;

  @override
  void initState() {
    super.initState();
    _trackingService.listenToTrip('demo-trip', (data) {
      if (mounted) {
        setState(() {
          _lat = data['latitude']?.toDouble() ?? _lat;
          _lng = data['longitude']?.toDouble() ?? _lng;
          _speed = data['speedKmh']?.toDouble() ?? _speed;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // 1. Simulated Live Vector Map Canvas
        Positioned.fill(
          child: Container(
            color: const Color(0xFFE2E8F0),
            child: Stack(
              children: [
                // Map grid background illustration
                Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.9),
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.primaryNavy.withValues(alpha: 0.15),
                              blurRadius: 30,
                              spreadRadius: 10,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.directions_bus_filled_rounded,
                          size: 48,
                          color: AppTheme.accentGold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryDark,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          '34 ABC 123 • ${_speed.toStringAsFixed(0)} km/s',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),

        // 2. Top Floating Info Pill (Remaining Stops & ETA)
        Positioned(
          top: 16,
          left: 16,
          right: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 15,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.successGreen.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.timer_rounded, color: AppTheme.successGreen, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Servis Yaklaşıyor',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppTheme.textPrimary),
                      ),
                      Text(
                        'Evinize $_remainingStops durak kaldı (Tahmini: $_etaMinutes)',
                        style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.accentGold.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    _etaMinutes,
                    style: const TextStyle(color: Color(0xFFB45309), fontWeight: FontWeight.w800, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ),

        // 3. Bottom Sliding Details Sheet
        Positioned(
          bottom: 16,
          left: 16,
          right: 16,
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.12),
                  blurRadius: 25,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Student Status Row
                Row(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: AppTheme.primaryNavy.withValues(alpha: 0.1),
                      child: const Text('CY', style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryNavy)),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Can Yılmaz', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
                          Text('2-A • Kadıköy Atatürk İlkokulu', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppTheme.successGreen.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.check_circle_rounded, size: 14, color: AppTheme.successGreen),
                          SizedBox(width: 4),
                          Text('Serviste', style: TextStyle(color: AppTheme.successGreen, fontWeight: FontWeight.w700, fontSize: 12)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                const Divider(height: 1),
                const SizedBox(height: 18),

                // Driver & Hostess Quick Action Row
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.person_pin, color: AppTheme.primaryNavy, size: 28),
                            const SizedBox(width: 10),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Mehmet Şoför', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                                  Text('0555 123 45 67', style: TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
                                ],
                              ),
                            ),
                            IconButton(
                              onPressed: () {},
                              icon: const Icon(Icons.phone_in_talk_rounded, color: AppTheme.successGreen),
                              constraints: const BoxConstraints(),
                              padding: EdgeInsets.zero,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
