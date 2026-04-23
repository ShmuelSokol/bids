-- dbo.contract_mod_clin_1_view



/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */

/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */


/* view contract_mod_clin_1_view: add view */
CREATE VIEW [dbo].[contract_mod_clin_1_view]
AS
SELECT        dbo.contract_mod_part_1_view.cntrct_kd4, dbo.contract_mod_part_1_view.rel_no_kd4, dbo.contract_mod_part_1_view.cntrct_k79, dbo.contract_mod_part_1_view.rel_no_k80, 
                         dbo.contract_mod_part_1_view.adtime_kd4, dbo.contract_mod_part_1_view.modnum_kd4, dbo.contract_mod_part_1_view.modate_kd4, dbo.contract_mod_part_1_view.modsrc_kd4, 
                         dbo.contract_mod_part_1_view.modval_kd4, dbo.contract_mod_part_1_view.modtxt_kd4, dbo.kd5_tab.mrtype_kd5, dbo.kd5_tab.clinno_kd5, dbo.clin_basic_1_view.clinno_k81, 
                         dbo.clin_basic_1_view.fsc_k08 AS fsc_cln, dbo.clin_basic_1_view.niin_k08 AS niin_cln, dbo.clin_basic_1_view.cage_k13 AS m_cage_cln, dbo.clin_basic_1_view.prtnum_k71 AS prtnum_cln, 
                         dbo.clin_basic_1_view.p_desc_k71 AS p_desc_cln, dbo.kd5_tab.cln_ui_kd5, dbo.contract_mod_part_1_view.mgclas_kd6, dbo.contract_mod_part_1_view.mgrttl_kd6, dbo.contract_mod_part_1_view.msclas_kd6, 
                         dbo.kd5_tab.mcclas_kd5, dbo.contract_mod_part_1_view.filnam_kal, dbo.kd5_tab.qtyold_kd5, dbo.kd5_tab.qtynew_kd5, dbo.kd5_tab.up_old_kd5, dbo.kd5_tab.up_new_kd5, dbo.kd5_tab.dlyold_kd5, 
                         dbo.kd5_tab.dlynew_kd5, dbo.kd5_tab.clntxt_kd5, dbo.kd5_tab.clnote_kd5, dbo.kd5_tab.mc_sta_kd5, dbo.kd5_tab.mc_tme_kd5, dbo.contract_mod_part_1_view.partno_prt, 
                         dbo.contract_mod_part_1_view.p_desc_prt, dbo.contract_mod_part_1_view.fsc_prt, dbo.contract_mod_part_1_view.niin_prt, dbo.contract_mod_part_1_view.m_cage_prt, dbo.contract_mod_part_1_view.p_um_prt, 
                         dbo.kd5_tab.idnk81_kd5, dbo.contract_mod_part_1_view.idnk08_k08, dbo.contract_mod_part_1_view.idnkd6_kd6, dbo.clin_basic_1_view.idnk71_k71, dbo.contract_mod_part_1_view.idnk79_k79, 
                         dbo.contract_mod_part_1_view.idnk80_k80, dbo.clin_basic_1_view.idnk81_k81, dbo.contract_mod_part_1_view.idnkal_kal, dbo.contract_mod_part_1_view.idnkd4_kd4, dbo.kd5_tab.idnkd5_kd5, 
                         dbo.kd5_tab.mcuk12_kd5, dbo.kd5_tab.mcck12_kd5, dbo.clin_basic_1_view.ordrno_k81, dbo.contract_mod_part_1_view.piidno_kd4, dbo.clin_basic_1_view.piidno_k80, dbo.clin_basic_1_view.docntr_k80
FROM            dbo.contract_mod_part_1_view LEFT OUTER JOIN
                         dbo.kd5_tab ON dbo.kd5_tab.idnkd7_kd5 = dbo.contract_mod_part_1_view.idnkd7_kd7 LEFT OUTER JOIN
                         dbo.clin_basic_1_view ON dbo.kd5_tab.idnk81_kd5 = dbo.clin_basic_1_view.idnk81_k81


















