package bd.landarchive.lrgetbdpro

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import bd.landarchive.lrgetbdpro.ui.DownloadGalleryScreen
import bd.landarchive.lrgetbdpro.ui.screens.NationwideProcessingScreen
import bd.landarchive.lrgetbdpro.ui.viewmodels.NationwideViewModel
import bd.landarchive.lrgetbdpro.viewmodel.PdfGalleryViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    var selectedTab by remember { mutableIntStateOf(0) }
                    val nationwideViewModel: NationwideViewModel = viewModel()
                    val galleryViewModel: PdfGalleryViewModel = viewModel()

                    Scaffold(
                        bottomBar = {
                            NavigationBar {
                                NavigationBarItem(
                                    selected = selectedTab == 0,
                                    onClick = { selectedTab = 0 },
                                    icon = {
                                        Icon(
                                            imageVector = Icons.Default.CloudDownload,
                                            contentDescription = "Extractor"
                                        )
                                    },
                                    label = { Text("Extractor") }
                                )
                                NavigationBarItem(
                                    selected = selectedTab == 1,
                                    onClick = {
                                        selectedTab = 1
                                        galleryViewModel.loadDownloadedRecords()
                                    },
                                    icon = {
                                        Icon(
                                            imageVector = Icons.Default.Archive,
                                            contentDescription = "Archived Records"
                                        )
                                    },
                                    label = { Text("Archived Records") }
                                )
                            }
                        }
                    ) { innerPadding ->
                        Box(modifier = Modifier.padding(innerPadding)) {
                            when (selectedTab) {
                                0 -> NationwideProcessingScreen(viewModel = nationwideViewModel)
                                else -> DownloadGalleryScreen(viewModel = galleryViewModel)
                            }
                        }
                    }
                }
            }
        }
    }
}
