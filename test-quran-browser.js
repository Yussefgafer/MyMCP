// اختبار أداة تصفح القرآن

async function testQuranBrowser() {
  try {
    // 1. اختبار عرض السور
    console.log('=== اختبار عرض السور ===');
    const surahsResponse = await fetch('http://localhost:3000/mcp/tool/quran-browser', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'list_surahs',
        limit: 5
      })
    });
    const surahsData = await surahsResponse.json();
    console.log('النتيجة (عرض السور):', JSON.stringify(surahsData, null, 2));

    // 2. اختبار عرض سورة البقرة
    console.log('\n=== اختبار عرض سورة البقرة ===');
    const surahResponse = await fetch('http://localhost:3000/mcp/tool/quran-browser', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'get_surah',
        surah_number: 2,
        limit: 3
      })
    });
    const surahData = await surahResponse.json();
    console.log('النتيجة (سورة البقرة):', JSON.stringify(surahData, null, 2));

    // 3. اختبار البحث
    console.log('\n=== اختبار البحث ===');
    const searchResponse = await fetch('http://localhost:3000/mcp/tool/quran-browser', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'search',
        query: 'الرحمن',
        limit: 2
      })
    });
    const searchData = await searchResponse.json();
    console.log('نتيجة البحث:', JSON.stringify(searchData, null, 2));

  } catch (error) {
    console.error('حدث خطأ:', error);
  }
}

// تشغيل الاختبار
testQuranBrowser();
