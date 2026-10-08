import 'package:flutter_test/flutter_test.dart';
import 'package:oservis_mobile/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const OservisApp());
    expect(find.text('OSERVIS'), findsOneWidget);
  });
}
