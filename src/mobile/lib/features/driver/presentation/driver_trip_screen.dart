import 'package:flutter/material.dart';
import '../../../../core/services/tracking_service.dart';

class DriverTripScreen extends StatefulWidget {
  const DriverTripScreen({super.key});

  @override
  State<DriverTripScreen> createState() => _DriverTripScreenState();
}

class _DriverTripScreenState extends State<DriverTripScreen> {
  final TrackingService _trackingService = TrackingService();
  bool _isTripStarted = false;
  bool _isSweepCompleted = false;
  bool _isTrackingLocation = false;

  // Mock list of students for trip execution
  final List<Map<String, dynamic>> _students = [
    {
      'id': '1',
      'name': 'Can Yılmaz',
      'class': '2-A',
      'address': 'Rasimpaşa Mah. No:4 Kadıköy',
      'status': 'PENDING'
    },
    {
      'id': '2',
      'name': 'Elif Demir',
      'class': '3-B',
      'address': 'Caferağa Mah. Moda Cad. No:12',
      'status': 'PENDING'
    },
    {
      'id': '3',
      'name': 'Emir Kaya',
      'class': '1-C',
      'address': 'Fenerbahçe Mah. Lale Sok. No:8',
      'status': 'PENDING'
    },
  ];

  void _startTrip() {
    setState(() {
      _isTripStarted = true;
      _isTrackingLocation = true;
    });

    // Start GPS stream
    _trackingService.startLocationBroadcast(
      'demo-trip-id',
      'demo-vehicle-id',
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Sefer ve Canlı GPS Takibi Başlatıldı!'),
        backgroundColor: Colors.green,
      ),
    );
  }

  void _updateAttendance(int index, String newStatus) {
    setState(() {
      _students[index]['status'] = newStatus;
    });
  }

  void _showSweepDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.shield_outlined, color: Colors.orange),
            SizedBox(width: 8),
            Text('Sweep Kontrolü'),
          ],
        ),
        content: const Text(
          'Lütfen aracın en arkasına kadar giderek koltukları ve altlarını kontrol ediniz. Araçta çocuk kalmadığını onaylıyor musunuz?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('İptal'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
            onPressed: () {
              setState(() {
                _isSweepCompleted = true;
              });
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Araç içi tarama (Sweep) onaylandı.'),
                  backgroundColor: Colors.orange,
                ),
              );
            },
            child: const Text('Onaylıyorum (Araç Temiz)'),
          ),
        ],
      ),
    );
  }

  void _finishTrip() {
    if (!_isSweepCompleted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('HATA: Araç içi Sweep kontrolü yapılmadan sefer bitirilemez!'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    _trackingService.stopLocationBroadcast('demo-trip-id');

    setState(() {
      _isTripStarted = false;
      _isTrackingLocation = false;
    });

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Tebrikler!'),
        content: const Text('Sefer ve öğrenci teslimatları başarıyla tamamlandı.'),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Kapat'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Şoför Sefer Paneli'),
        actions: [
          if (_isTrackingLocation)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Icon(Icons.gps_fixed, color: Colors.greenAccent, size: 18),
                  SizedBox(width: 4),
                  Text('GPS Canlı', style: TextStyle(fontSize: 12)),
                ],
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          // Header Status Card
          Container(
            padding: const EdgeInsets.all(16),
            color: const Color(0xFF1E3A8A).withValues(alpha: 0.05),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('34 ABC 123 • Kadıköy Atatürk İlkokulu',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(
                        _isTripStarted
                            ? (_isSweepCompleted ? 'Durum: Sweep Tamamlandı' : 'Durum: Seferde')
                            : 'Durum: Planlandı',
                        style: TextStyle(
                          color: _isTripStarted ? Colors.green.shade700 : Colors.grey.shade700,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (!_isTripStarted)
                  ElevatedButton(
                    onPressed: _startTrip,
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                    child: const Text('Seferi Başlat'),
                  )
                else
                  ElevatedButton(
                    onPressed: _finishTrip,
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                    child: const Text('Seferi Bitir'),
                  ),
              ],
            ),
          ),

          // Student Attendance List
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _students.length,
              itemBuilder: (context, index) {
                final student = _students[index];
                final status = student['status'];

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              student['name'],
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                            Chip(
                              label: Text(
                                status,
                                style: const TextStyle(fontSize: 11, color: Colors.white),
                              ),
                              backgroundColor: status == 'BOARDED'
                                  ? Colors.green
                                  : status == 'DROPPED_OFF'
                                      ? Colors.blue
                                      : status == 'NO_SHOW'
                                          ? Colors.red
                                          : Colors.grey,
                            ),
                          ],
                        ),
                        Text('Sınıf: ${student['class']} • ${student['address']}',
                            style: const TextStyle(color: Colors.grey, fontSize: 13)),
                        const SizedBox(height: 8),
                        if (_isTripStarted)
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  icon: const Icon(Icons.login, size: 16, color: Colors.green),
                                  label: const Text('Bindi', style: TextStyle(color: Colors.green, fontSize: 12)),
                                  onPressed: () => _updateAttendance(index, 'BOARDED'),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: OutlinedButton.icon(
                                  icon: const Icon(Icons.logout, size: 16, color: Colors.blue),
                                  label: const Text('İndi', style: TextStyle(color: Colors.blue, fontSize: 12)),
                                  onPressed: () => _updateAttendance(index, 'DROPPED_OFF'),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: OutlinedButton.icon(
                                  icon: const Icon(Icons.close, size: 16, color: Colors.red),
                                  label: const Text('Yok', style: TextStyle(color: Colors.red, fontSize: 12)),
                                  onPressed: () => _updateAttendance(index, 'NO_SHOW'),
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // Sweep Verification Action Bar
          if (_isTripStarted)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, -4))
                ],
              ),
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _isSweepCompleted ? Colors.grey : Colors.orange,
                ),
                icon: Icon(_isSweepCompleted ? Icons.check_circle : Icons.qr_code_scanner),
                label: Text(_isSweepCompleted ? 'Sweep Onaylandı' : 'Araç İçi Sweep (Güvenlik) Taraması Yap'),
                onPressed: _isSweepCompleted ? null : _showSweepDialog,
              ),
            ),
        ],
      ),
    );
  }
}
