-- dbo.web_rfq_line_2_view



/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */

/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */


/* view web_rfq_line_2_view: add view */
CREATE VIEW [dbo].[web_rfq_line_2_view]
AS
SELECT     dbo.sol_part_5_view.sol_no_k10, dbo.sol_part_5_view.c_stat_kc4, dbo.web_rfq_line_1_view.fsc_k08, dbo.web_rfq_line_1_view.niin_k08, 
                      dbo.web_rfq_line_1_view.p_desc_k08, dbo.web_rfq_line_1_view.f_name_qtr, dbo.web_rfq_line_1_view.s07dte_kd0, dbo.web_rfq_line_1_view.q_type_kd0, 
                      dbo.web_rfq_line_1_view.m_cage_kd0, dbo.web_rfq_line_1_view.mfg_pn_kd0, dbo.web_rfq_line_1_view.pn_rev_kd0, dbo.web_rfq_line_1_view.qotqty_kd0, 
                      dbo.web_rfq_line_1_view.untcst_kd0, dbo.web_rfq_line_1_view.dlyaro_kd0, dbo.web_rfq_line_1_view.valday_kd0, dbo.web_rfq_line_1_view.fobtyp_kd0, 
                      dbo.web_rfq_line_1_view.fobzip_kd0, dbo.web_rfq_line_1_view.idnk08_k08, dbo.web_rfq_line_1_view.idnkd0_kd0, dbo.web_rfq_line_1_view.idns07_kd0
FROM         dbo.sol_part_5_view INNER JOIN
                      dbo.kau_tab ON dbo.sol_part_5_view.idnkc4_kc4 = dbo.kau_tab.idngx2_kau AND dbo.kau_tab.gx2tbl_kau = 'kc4' INNER JOIN
                      dbo.web_rfq_line_1_view ON dbo.kau_tab.idngx1_kau = dbo.web_rfq_line_1_view.idnkd0_kd0 AND dbo.kau_tab.gx1tbl_kau = 'kd0'


















