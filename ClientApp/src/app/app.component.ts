import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalculatorComponent } from './calculator/calculator.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, CalculatorComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  showModal = false;
  activeTab: 'flow' | 'tech' | 'help' = 'flow';

  openModal(tab: 'flow' | 'tech' | 'help') {
    this.activeTab = tab;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }
}
