-- dbo.shipment_line_2_view



/* view shipment_line_2_view: add view */


/* view shipment_line_2_view: add view */


/* view shipment_line_2_view: add view */

/* view shipment_line_2_view: add view */


/* view shipment_line_2_view: add view */


/* view shipment_line_2_view: add view */


/* view shipment_line_2_view: add view */
CREATE VIEW [dbo].[shipment_line_2_view]
AS
SELECT        dbo.shipment_line_1_view.cntrct_k79, dbo.shipment_line_1_view.rel_no_k80, dbo.shipment_line_1_view.clinno_k81, dbo.shipment_line_1_view.faspay_k80, dbo.shipment_line_1_view.job_no_ka8, 
                         dbo.shipment_line_1_view.jln_no_ka9, dbo.shipment_line_1_view.jlndte_ka9, dbo.shipment_line_1_view.jrqpur_ka9, dbo.shipment_line_1_view.jlnqty_ka9, dbo.shipment_line_1_view.jlnsta_ka9, 
                         dbo.shipment_line_1_view.jlnsdt_ka9, dbo.shipment_line_1_view.pinval_ka9, dbo.shipment_line_1_view.xinval_ka9, dbo.shipment_line_1_view.potval_ka9, dbo.shipment_line_1_view.selval_ka9, 
                         dbo.shipment_line_1_view.idnk81_ka9, dbo.shipment_line_1_view.idnka8_ka8, dbo.shipment_line_1_view.idnka9_ka9, dbo.shipment_line_1_view.fsc_k08, dbo.shipment_line_1_view.niin_k08, 
                         dbo.shipment_line_1_view.prtnum_k71, dbo.shipment_line_1_view.pr_num_k81, dbo.shipment_line_1_view.clnqty_k81, dbo.shipment_line_1_view.upkqty_k81, dbo.shipment_line_1_view.cln_up_k81, 
                         dbo.shipment_line_1_view.cln_ui_k81, dbo.shipment_line_1_view.clnext_k81, dbo.shipment_line_1_view.reqdly_k81, dbo.shipment_line_1_view.cxq_01_k81, dbo.shipment_line_1_view.coq_01_k81, 
                         dbo.shipment_line_1_view.prsmth_k81, dbo.shipment_line_1_view.fob_od_k81, dbo.shipment_line_1_view.ins_sd_k81, dbo.shipment_line_1_view.acc_sd_k81, dbo.shipment_line_1_view.ordrno_k81, 
                         dbo.shipment_line_1_view.idnk79_k79, dbo.shipment_line_1_view.idnk80_k80, dbo.shipment_line_1_view.idnk81_k81, dbo.shipment_line_1_view.idnkaj_kaj, dbo.shipment_line_1_view.shpnum_kaj, 
                         dbo.shipment_line_1_view.packed_kaj, dbo.shipment_line_1_view.podcod_kaj, dbo.shipment_line_1_view.poecod_kaj, dbo.shipment_line_1_view.bolnum_kaj, dbo.shipment_line_1_view.insdte_kaj, 
                         dbo.shipment_line_1_view.edi_id_kaj, dbo.shipment_line_1_view.t_mode_kaj, dbo.shipment_line_1_view.shptme_kaj, dbo.shipment_line_1_view.shpsta_kaj, dbo.shipment_line_1_view.trakno_kaj, 
                         dbo.shipment_line_1_view.pkg_wt_kaj, dbo.shipment_line_1_view.wawuid_kaj, dbo.shipment_line_1_view.bxxcnt_kaj, dbo.shipment_line_1_view.boxcnt_kaj, dbo.shipment_line_1_view.shpdes_kaj, 
                         dbo.shipment_line_1_view.e_code_k12, dbo.shipment_line_1_view.e_name_k12, dbo.shipment_line_1_view.gduset_ka7, dbo.shipment_line_1_view.idnk12_k12, dbo.shipment_line_1_view.idnk71_k71, 
                         dbo.shipment_line_1_view.idnka7_ka7, dbo.shipment_line_1_view.idnkbg_kaj, dbo.shipment_line_1_view.idnk08_k08, dbo.shipment_line_1_view.piidno_k80, dbo.shipment_line_1_view.docntr_k80, 
                         dbo.kbg_tab.idnkbg_kbg, dbo.kbg_tab.stgnum_kbg
FROM            dbo.shipment_line_1_view LEFT OUTER JOIN
                         dbo.kbg_tab ON dbo.kbg_tab.idnkbg_kbg = dbo.shipment_line_1_view.idnkbg_kaj







