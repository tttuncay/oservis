import 'package:flutter/material.dart';
import '../../../../core/services/tracking_service.dart';

class ParentTrackingScreen extends StatefulWidget {
  const ParentTrackingScreen({super.key});

  @override
  State<ParentTrackingScreen> createState() => _ParentTrackingScreenState();
}

class _ParentTrackingScreenState extends State<ParentTrackingScreen> {
  final TrackingService _trackingService = TrackingService();
  double? _vehicleLat = 40.9900;
  double? _vehicleLng = 29.0250;
  double? _speedKmh = 42.0;
  final String _childStatus = 'BOARDED'; // BOARDED, DROPPED_OFF, PENDING
  final String _eta = '8 dakika';

  @override
  void initState() {
    super.initState();
    _startListening();
  }

  void _startListening() {
    _trackingService.listenToTrip('demo-trip-id', (locationData) {
      if (mounted) {
        setState(() {
          _vehicleLat = locationData['latitude']?.toDouble();
          _vehicleLng = locationData['longitude']?.toDouble();
          _speedKmh = locationData['speedKmh']?.toDouble();
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Canlı Servis Takibi'),
      ),
      body: Column(
        children: [
          // Live Map Placeholder / Simulation Area
          Expanded(
            flex: 3,
            child: Container(
              color: Colors.blueGrey.shade100,
              child: Stack(
                children: [
                  Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.map_outlined, size: 64, color: Colors.blueGrey),
                        const SizedBox(height: 8),
                        Text(
                          'Canlı Harita Alanı (Google Maps / Mapbox)\nEnlem: ${_vehicleLat?.toStringAsFixed(4)}, Boylam: ${_vehicleLng?.toStringAsFixed(4)}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.black54, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                  Positioned(
                    top: 16,
                    right: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 4),
                        ],
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.speed, size: 16, color: Colors.blue),
                          const SizedBox(width: 4),
                          Text('${_speedKmh?.toStringAsFixed(0)} km/h',
                              style: const TextStyle(fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Child Status Card
          Expanded(
            flex: 2,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [
                  BoxShadow(color: Colors.black12, blurRadius: 10, offset: Offset(0, -4)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Can Yılmaz', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                          Text('2-A • Kadıköy Atatürk İlkokulu', style: TextStyle(color: Colors.grey)),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: _childStatus == 'BOARDED' ? Colors.green.shade50 : Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _childStatus == 'BOARDED' ? Colors.green : Colors.blue,
                          ),
                        ),
                        child: Text(
                          _childStatus == 'BOARDED' ? 'Serviste' : 'İndi',
                          style: TextStyle(
                            color: _childStatus == 'BOARDED' ? Colors.green.shade800 : Colors.blue.shade800,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 32),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildInfoItem(Icons.timer_outlined, 'Tahmini Varış', _eta),
                      _buildInfoItem(Icons.directions_bus, 'Araç', '34 ABC 123'),
                      _buildInfoItem(Icons.phone, 'Şoför İletişim', 'Mehmet Bey'),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoItem(IconData icon, String label, String value) {
    return Column(
      children: [
        Icon(icon, color: const Color(0xFF1E3A8A)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
      ],
    );
  }
}
