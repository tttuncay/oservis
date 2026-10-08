import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import 'tabs/parent_live_tracking_tab.dart';
import 'tabs/parent_timeline_tab.dart';
import 'tabs/parent_absence_tab.dart';
import 'tabs/parent_finance_tab.dart';

class ParentHomeScreen extends StatefulWidget {
  const ParentHomeScreen({super.key});

  @override
  State<ParentHomeScreen> createState() => _ParentHomeScreenState();
}

class _ParentHomeScreenState extends State<ParentHomeScreen> {
  int _currentIndex = 0;

  final List<Widget> _tabs = const [
    ParentLiveTrackingTab(),
    ParentTimelineTab(),
    ParentAbsenceTab(),
    ParentFinanceTab(),
  ];

  final List<String> _titles = const [
    'Canlı Servis Takibi',
    'Servis Günlüğü & Durum',
    'Devamsızlık Bildir',
    'Ödeme & Taksitler',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_currentIndex]),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {},
          ),
        ],
      ),
      body: _tabs[_currentIndex],
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 20,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: BottomNavigationBar(
              currentIndex: _currentIndex,
              onTap: (index) => setState(() => _currentIndex = index),
              type: BottomNavigationBarType.fixed,
              backgroundColor: Colors.transparent,
              elevation: 0,
              selectedItemColor: AppTheme.primaryNavy,
              unselectedItemColor: AppTheme.textSecondary,
              selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11),
              unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 11),
              items: const [
                BottomNavigationBarItem(
                  icon: Icon(Icons.near_me_outlined),
                  activeIcon: Icon(Icons.near_me_rounded),
                  label: 'Canlı Takip',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.history_edu_outlined),
                  activeIcon: Icon(Icons.history_edu_rounded),
                  label: 'Durum',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.event_busy_outlined),
                  activeIcon: Icon(Icons.event_busy_rounded),
                  label: 'İzin Bildir',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.account_balance_wallet_outlined),
                  activeIcon: Icon(Icons.account_balance_wallet_rounded),
                  label: 'Taksitler',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
