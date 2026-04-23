-- dbo.po_line_1_view



/* view po_line_1_view: add view */


/* view po_line_1_view: add view */


/* view po_line_1_view: add view */

/* view po_line_1_view: add view */


/* view po_line_1_view: add view */


/* view po_line_1_view: add view */


/* view po_line_1_view: add view */


/* view po_line_1_view: add view */


/* view po_line_1_view: add view */


/* view po_line_1_view: add view */


/* view po_line_1_view: add view */


/* view po_line_1_view: add view */


/* view po_line_1_view: add view */


/* view po_line_1_view: add view */


/* view po_line_1_view: add view */
CREATE VIEW [dbo].[po_line_1_view]
AS
SELECT        dbo.k39_tab.s_code_k39, dbo.k12_tab.e_name_k12, dbo.k89_tab.por_no_k89, dbo.k89_tab.poruno_k89, dbo.k89_tab.pocono_k89, dbo.k89_tab.podsta_k89, dbo.k89_tab.rcvsta_k89, dbo.k89_tab.insrce_k89, 
                         dbo.k89_tab.faster_k89, dbo.k89_tab.cnt_no_k89, dbo.k89_tab.cntpri_k89, dbo.k89_tab.fobtyp_k89, dbo.k89_tab.fobzip_k89, dbo.k89_tab.po_val_k89, dbo.k89_tab.rsalno_k89, dbo.k89_tab.po_dte_k89, 
                         dbo.k08_tab.fsc_k08, dbo.k08_tab.niin_k08, dbo.k13_tab.cage_k13, dbo.k89_tab.cnfirm_k89, dbo.k89_tab.shpvia_k89, dbo.k89_tab.fcharg_k89, dbo.k89_tab.shorts_k89, dbo.k71_tab.pn_rev_k71, 
                         dbo.k71_tab.prtnum_k71, dbo.k71_tab.p_desc_k71, dbo.k90_tab.p_cage_k90, dbo.k90_tab.partno_k90, dbo.k90_tab.pop_um_k90, dbo.k90_tab.popseq_k90, dbo.k90_tab.qotdte_k90, dbo.k90_tab.qrefno_k90, 
                         dbo.k90_tab.snq_11_k90, dbo.k90_tab.soq_11_k90, dbo.k90_tab.poxval_k90, dbo.k91_tab.dlyseq_k91, dbo.k91_tab.polext_k91, dbo.k91_tab.polval_k91, dbo.k91_tab.dlysss_k91, dbo.k91_tab.reqdly_k91, 
                         dbo.k91_tab.untcst_k91, dbo.k91_tab.po_qty_k91, dbo.k91_tab.udsqty_k91, dbo.k91_tab.polxvl_k91, dbo.k91_tab.soq_11_k91, dbo.k90_tab.idnrqm_k90, dbo.k79_tab.cntrct_k79, dbo.k06_tab.trmdes_k06, 
                         dbo.k06_tab.idnk06_k06, dbo.k08_tab.idnk08_k08, dbo.k12_tab.idnk12_k12, dbo.k13_tab.idnk13_k13, dbo.k89_tab.buyk14_k89, dbo.k39_tab.idnk39_k39, dbo.k71_tab.idnk71_k71, dbo.k89_tab.idnk89_k89, 
                         dbo.k90_tab.idnk90_k90, dbo.k91_tab.idnk91_k91, dbo.k90_tab.invk96_k90, dbo.k90_tab.rqmtab_k90, dbo.k79_tab.idnk79_k79
FROM            dbo.k12_tab INNER JOIN
                         dbo.k91_tab INNER JOIN
                         dbo.k71_tab INNER JOIN
                         dbo.k08_tab ON dbo.k71_tab.idnk08_k71 = dbo.k08_tab.idnk08_k08 INNER JOIN
                         dbo.k90_tab LEFT OUTER JOIN
                         dbo.k84_tab ON dbo.k90_tab.idnrqm_k90 = dbo.k84_tab.idnk84_k84 AND dbo.k90_tab.rqmtab_k90 = 'k84' LEFT OUTER JOIN
                         dbo.k79_tab ON dbo.k84_tab.idnk79_k84 = dbo.k79_tab.idnk79_k79 ON dbo.k71_tab.idnk71_k71 = dbo.k90_tab.idnk71_k90 INNER JOIN
                         dbo.k13_tab ON dbo.k71_tab.idnk13_k71 = dbo.k13_tab.idnk13_k13 ON dbo.k91_tab.idnk90_k91 = dbo.k90_tab.idnk90_k90 INNER JOIN
                         dbo.k89_tab ON dbo.k90_tab.idnk89_k90 = dbo.k89_tab.idnk89_k89 INNER JOIN
                         dbo.k39_tab ON dbo.k89_tab.idnk39_k89 = dbo.k39_tab.idnk39_k39 ON dbo.k12_tab.idnk12_k12 = dbo.k39_tab.idnk12_k39 INNER JOIN
                         dbo.k06_tab ON dbo.k89_tab.idnk06_k89 = dbo.k06_tab.idnk06_k06















