import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:signalr_netcore/signalr_client.dart';
import '../network/api_client.dart';

class TrackingService {
  static const String hubUrl = 'http://localhost:5000/hubs/tracking';
  HubConnection? _hubConnection;
  StreamSubscription<Position>? _positionSubscription;
  final ApiClient _apiClient = ApiClient();

  // 1. Connect to SignalR Hub
  Future<void> initSignalR() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('access_token') ?? '';

    _hubConnection = HubConnectionBuilder()
        .withUrl(
          hubUrl,
          options: HttpConnectionOptions(
            accessTokenFactory: () async => token,
          ),
        )
        .withAutomaticReconnect()
        .build();

    await _hubConnection!.start();
  }

  // 2. Parent / Admin: Listen to live location updates for a trip
  Future<void> listenToTrip(String tripId, Function(dynamic) onLocationReceived) async {
    if (_hubConnection?.state != HubConnectionState.Connected) {
      await initSignalR();
    }

    await _hubConnection?.invoke('JoinTripTracking', args: [tripId]);
    _hubConnection?.on('OnLocationUpdate', (arguments) {
      if (arguments != null && arguments.isNotEmpty) {
        onLocationReceived(arguments[0]);
      }
    });
  }

  // 3. Driver: Start background/active GPS broadcast
  Future<void> startLocationBroadcast(String tripId, String vehicleId) async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10, // Send updates every 10 meters
      ),
    ).listen((Position position) async {
      try {
        await _apiClient.dio.post('/trips/location-ping', data: {
          'tripId': tripId,
          'vehicleId': vehicleId,
          'latitude': position.latitude,
          'longitude': position.longitude,
          'speedKmh': (position.speed * 3.6).roundToDouble(),
          'bearing': position.heading,
          'accuracyM': position.accuracy,
        });
      } catch (e) {
        // Retry or queue in SQLite offline buffer
      }
    });
  }

  // 4. Stop tracking
  Future<void> stopLocationBroadcast(String tripId) async {
    await _positionSubscription?.cancel();
    _positionSubscription = null;
    await _hubConnection?.invoke('LeaveTripTracking', args: [tripId]);
  }
}
