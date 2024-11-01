import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProgressInfoComponent } from './progress-info.component';

describe('ProgressInfoComponent', () => {
  let component: ProgressInfoComponent;
  let fixture: ComponentFixture<ProgressInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressInfoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProgressInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
