using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Diagnostics;
using System.Drawing;
using System.Windows.Forms;

namespace WinApp
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
        }

        private void btnDate_Click(object sender, EventArgs e)
        {
            MessageBox.Show(monthCalendar1.SelectionRange.Start.ToString());
        }

        private void linkLabel1_LinkClicked(object sender, LinkLabelLinkClickedEventArgs e)
        {
            Process.Start(Application.StartupPath + "\\Help.rtf");
            //Process.Start(Application.StartupPath + "\\ReadMe.txt");
        }

        private void Form1_Load(object sender, EventArgs e)
        {
            this.Text = "Version " + Application.ProductVersion;
        }
    }
}
